"""
UnivFD Linear Probe Fine-Tuning Script
=======================================
The original UnivFD probe (Ojha et al. CVPR 2023) was trained on GAN images
from 2020. It generalizes well to diffusion models but has lower accuracy on
video deepfakes (face-swap, reenactment) because those weren't in its training set.

This script fine-tunes the linear probe on a small set of current deepfakes
while keeping CLIP frozen. Because CLIP features are already excellent, you
only need ~500-2000 labeled examples to meaningfully improve accuracy.

Usage:
    # 1. Prepare your dataset:
    #    data/real/   — real face images (jpg/png)
    #    data/fake/   — deepfake images (face-swaps, reenactment, diffusion)

    python scripts/finetune_univfd.py \
        --data_dir data/ \
        --output_path backend/weights/fc_weights_finetuned.pth \
        --epochs 20 \
        --lr 1e-3

    # 2. The backend will automatically use the finetuned weights if present.
    #    Update UNIVFD_WEIGHTS_PATH in backend/main.py to point to the new file.

Requirements:
    pip install torch torchvision pillow tqdm scikit-learn
    pip install git+https://github.com/openai/CLIP.git
"""

import argparse
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from PIL import Image
from tqdm import tqdm

try:
    import clip
except ImportError:
    raise SystemExit("Install CLIP: pip install git+https://github.com/openai/CLIP.git")

try:
    from sklearn.metrics import roc_auc_score
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


# ── Dataset ───────────────────────────────────────────────────────────────────

class DeepfakeDataset(Dataset):
    """
    Expects:
        data_dir/real/  — real images  (label 0)
        data_dir/fake/  — fake images  (label 1)
    """
    EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}

    def __init__(self, data_dir: Path, preprocess, split='train', val_ratio=0.15, seed=42):
        self.preprocess = preprocess
        real_files = [p for p in (data_dir / 'real').rglob('*') if p.suffix.lower() in self.EXTENSIONS]
        fake_files = [p for p in (data_dir / 'fake').rglob('*') if p.suffix.lower() in self.EXTENSIONS]

        if not real_files:
            raise FileNotFoundError(f"No real images found in {data_dir / 'real'}")
        if not fake_files:
            raise FileNotFoundError(f"No fake images found in {data_dir / 'fake'}")

        # Balance classes
        n = min(len(real_files), len(fake_files))
        rng = random.Random(seed)
        real_files = rng.sample(real_files, n)
        fake_files = rng.sample(fake_files, n)

        all_files  = [(f, 0) for f in real_files] + [(f, 1) for f in fake_files]
        rng.shuffle(all_files)

        split_idx = int(len(all_files) * (1 - val_ratio))
        if split == 'train':
            self.samples = all_files[:split_idx]
        else:
            self.samples = all_files[split_idx:]

        print(f"  {split}: {len(self.samples)} samples "
              f"({sum(1 for _, l in self.samples if l == 0)} real, "
              f"{sum(1 for _, l in self.samples if l == 1)} fake)")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        try:
            img = Image.open(path).convert('RGB')
            return self.preprocess(img), torch.tensor(label, dtype=torch.float32)
        except Exception as e:
            print(f"  Warning: could not load {path}: {e}")
            # Return a blank image on error
            img = Image.new('RGB', (224, 224))
            return self.preprocess(img), torch.tensor(label, dtype=torch.float32)


# ── Feature extraction ────────────────────────────────────────────────────────

@torch.no_grad()
def extract_features(loader: DataLoader, clip_model, device: str) -> tuple[np.ndarray, np.ndarray]:
    """Pre-extract CLIP features for the entire dataset (much faster than inline)."""
    all_feats, all_labels = [], []
    for images, labels in tqdm(loader, desc='  Extracting CLIP features'):
        images = images.to(device)
        feats  = clip_model.encode_image(images)
        feats  = feats / feats.norm(dim=-1, keepdim=True)
        all_feats.append(feats.cpu().numpy())
        all_labels.append(labels.numpy())
    return np.concatenate(all_feats), np.concatenate(all_labels)


# ── Training ──────────────────────────────────────────────────────────────────

def train(args):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"\nDevice: {device}")

    # Load CLIP
    print("Loading CLIP ViT-L/14...")
    clip_model, preprocess = clip.load('ViT-L/14', device=device)
    clip_model.eval()

    # Load datasets
    data_dir = Path(args.data_dir)
    print(f"\nLoading dataset from {data_dir}...")
    train_ds = DeepfakeDataset(data_dir, preprocess, split='train')
    val_ds   = DeepfakeDataset(data_dir, preprocess, split='val')

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,  num_workers=2)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size, shuffle=False, num_workers=2)

    # Pre-extract features (CLIP is frozen — no need to re-run every epoch)
    print("\nPre-extracting features (one-time cost)...")
    train_feats, train_labels = extract_features(train_loader, clip_model, device)
    val_feats,   val_labels   = extract_features(val_loader,   clip_model, device)

    train_feats_t  = torch.from_numpy(train_feats).float().to(device)
    train_labels_t = torch.from_numpy(train_labels).float().to(device)
    val_feats_t    = torch.from_numpy(val_feats).float().to(device)
    val_labels_t   = torch.from_numpy(val_labels).float().to(device)

    # Load existing probe as starting point (transfer from GAN-trained weights)
    probe = nn.Linear(768, 1).to(device)
    existing_weights = Path(args.pretrained_weights)
    if existing_weights.exists():
        print(f"\nLoading pretrained UnivFD weights from {existing_weights}...")
        state = torch.load(str(existing_weights), map_location=device, weights_only=True)
        if isinstance(state, dict):
            probe.load_state_dict(state)
        else:
            probe.weight.data = state.float().reshape(1, 768)
            probe.bias.data   = torch.zeros(1, device=device)
        print("  Pretrained weights loaded — fine-tuning from here")
    else:
        print("\n  No pretrained weights found — training from scratch")

    optimizer = torch.optim.AdamW(probe.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    criterion = nn.BCEWithLogitsLoss()

    best_auc  = 0.0
    best_path = Path(args.output_path)
    best_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"\nFine-tuning for {args.epochs} epochs...\n")

    for epoch in range(1, args.epochs + 1):
        # ── Train ──────────────────────────────────────────────────────────
        probe.train()
        perm   = torch.randperm(len(train_feats_t))
        losses = []
        for i in range(0, len(perm), args.batch_size):
            idx    = perm[i:i + args.batch_size]
            logits = probe(train_feats_t[idx]).squeeze(1)
            loss   = criterion(logits, train_labels_t[idx])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            losses.append(loss.item())
        scheduler.step()

        # ── Validate ───────────────────────────────────────────────────────
        probe.eval()
        with torch.no_grad():
            val_logits = probe(val_feats_t).squeeze(1)
            val_loss   = criterion(val_logits, val_labels_t).item()
            val_probs  = torch.sigmoid(val_logits).cpu().numpy()
            val_preds  = (val_probs > 0.5).astype(int)
            val_acc    = (val_preds == val_labels).mean()

        auc = roc_auc_score(val_labels, val_probs) if HAS_SKLEARN else 0.0

        print(f"  Epoch {epoch:3d}/{args.epochs} | "
              f"train_loss={np.mean(losses):.4f} | "
              f"val_loss={val_loss:.4f} | "
              f"val_acc={val_acc:.3f} | "
              f"val_auc={auc:.3f}")

        if auc > best_auc:
            best_auc = auc
            torch.save(probe.state_dict(), best_path)
            print(f"    ✅ New best AUC {best_auc:.4f} — saved to {best_path}")

    print(f"\nDone. Best val AUC: {best_auc:.4f}")
    print(f"Weights saved to: {best_path}")
    print("\nTo use the fine-tuned weights, update UNIVFD_WEIGHTS_PATH in backend/main.py:")
    print(f"  UNIVFD_WEIGHTS_PATH = WEIGHTS_DIR / '{best_path.name}'")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fine-tune UnivFD linear probe on current deepfakes')
    parser.add_argument('--data_dir',          default='data/',                              help='Directory with real/ and fake/ subdirs')
    parser.add_argument('--output_path',       default='backend/weights/fc_weights_finetuned.pth', help='Where to save the fine-tuned weights')
    parser.add_argument('--pretrained_weights',default='backend/weights/fc_weights.pth',    help='Existing UnivFD weights to start from')
    parser.add_argument('--epochs',            type=int,   default=20)
    parser.add_argument('--batch_size',        type=int,   default=64)
    parser.add_argument('--lr',                type=float, default=1e-3)
    args = parser.parse_args()
    train(args)
