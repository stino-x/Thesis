"""
Deepfake Detection Backend
===========================
FastAPI server running two CLIP-based detectors that generalize to unseen
generators — the key gap that in-browser CNN/ViT models can't cover:

  1. UnivFD  (Ojha et al. CVPR 2023)
     CLIP ViT-L/14 + linear probe trained on GAN images.
     Generalizes to diffusion models (SD, DALL-E, Midjourney) it never saw.
     Weights: ~4 KB (just a linear layer on top of CLIP).

  2. CLIP zero-shot fallback
     When UnivFD weights aren't present, uses text-similarity to
     "real photograph" vs "AI-generated image" prompts.

Why a backend?
  CLIP ViT-L/14 is ~300 MB. Running it in the browser would be too slow.
  The browser handles fast CNN/ViT models; this handles the heavy CLIP analysis.

Setup:
    pip install fastapi uvicorn torch torchvision pillow numpy
    pip install git+https://github.com/openai/CLIP.git

Run:
    uvicorn backend.main:app --reload --port 8787

Weights are auto-downloaded on first startup from the official repo.
"""

import io
import base64
import urllib.request
import numpy as np
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Deepfake Detection API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Weights ───────────────────────────────────────────────────────────────────

WEIGHTS_DIR = Path(__file__).parent / "weights"
WEIGHTS_DIR.mkdir(exist_ok=True)

UNIVFD_WEIGHTS_URL = (
    "https://github.com/WisconsinAIVision/UniversalFakeDetect"
    "/raw/main/pretrained_weights/fc_weights.pth"
)
UNIVFD_WEIGHTS_PATH = WEIGHTS_DIR / "fc_weights.pth"


def download_weights():
    """Download UnivFD weights on first run (~4 KB linear layer)."""
    if UNIVFD_WEIGHTS_PATH.exists():
        return
    print("  Downloading UnivFD weights (~4 KB)...")
    try:
        urllib.request.urlretrieve(UNIVFD_WEIGHTS_URL, UNIVFD_WEIGHTS_PATH)
        print(f"  UnivFD weights saved to {UNIVFD_WEIGHTS_PATH}")
    except Exception as e:
        print(f"  Could not download UnivFD weights: {e}")
        print(f"  Manual download: {UNIVFD_WEIGHTS_URL}")
        print(f"  Save to: {UNIVFD_WEIGHTS_PATH}")


# ── Model state ───────────────────────────────────────────────────────────────

_clip_model = None
_preprocess = None
_univfd_probe = None   # nn.Linear(768, 1) — the UnivFD linear probe
_device = "cpu"


def load_models():
    global _clip_model, _preprocess, _univfd_probe, _device

    if _clip_model is not None:
        return

    try:
        import torch
        import clip

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading CLIP ViT-L/14 on {_device}...")
        _clip_model, _preprocess = clip.load("ViT-L/14", device=_device)
        _clip_model.eval()
        print("  CLIP loaded")

        # Try to load UnivFD linear probe
        download_weights()
        if UNIVFD_WEIGHTS_PATH.exists():
            import torch.nn as nn
            probe = nn.Linear(768, 1)
            state = torch.load(str(UNIVFD_WEIGHTS_PATH), map_location=_device, weights_only=True)
            # The checkpoint is just the weight tensor for a single linear layer
            if isinstance(state, dict):
                probe.load_state_dict(state)
            else:
                # Raw tensor — assign directly
                probe.weight.data = state.float().reshape(1, 768)
                probe.bias.data = torch.zeros(1)
            _univfd_probe = probe.to(_device)
            _univfd_probe.eval()
            print("  UnivFD linear probe loaded")
        else:
            print("  UnivFD weights not found — using CLIP zero-shot fallback")

    except ImportError as e:
        print(f"  CLIP not installed: {e}")
        print("  Run: pip install git+https://github.com/openai/CLIP.git")
    except Exception as e:
        print(f"  Model loading error: {e}")


# ── Feature extraction ────────────────────────────────────────────────────────

def get_clip_features(image_bytes: bytes) -> Optional[np.ndarray]:
    if _clip_model is None:
        return None
    import torch
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inp = _preprocess(image).unsqueeze(0).to(_device)
    with torch.no_grad():
        feats = _clip_model.encode_image(inp)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    return feats.cpu().numpy()


# ── Scoring ───────────────────────────────────────────────────────────────────

def univfd_score(features: np.ndarray) -> tuple[float, str]:
    """Returns (fake_probability 0-1, method_name)."""
    import torch

    if _univfd_probe is not None:
        feat = torch.from_numpy(features).float().to(_device)
        with torch.no_grad():
            logit = _univfd_probe(feat)
            prob = torch.sigmoid(logit).item()
        return float(prob), "univfd"

    # Zero-shot CLIP fallback
    return clip_zeroshot(features), "clip_zeroshot"


def clip_zeroshot(features: np.ndarray) -> float:
    if _clip_model is None:
        return 0.5
    import torch
    import clip

    fake_prompts = [
        "an AI-generated image", "a deepfake photo", "a synthetic face",
        "a computer-generated image", "an image made by artificial intelligence",
        "a fake image generated by a neural network",
    ]
    real_prompts = [
        "a real photograph", "a genuine photo", "a real human face",
        "an authentic image", "a natural photograph taken by a camera",
    ]

    with torch.no_grad():
        fake_tok = clip.tokenize(fake_prompts).to(_device)
        real_tok = clip.tokenize(real_prompts).to(_device)
        fake_feats = _clip_model.encode_text(fake_tok).mean(0, keepdim=True)
        real_feats = _clip_model.encode_text(real_tok).mean(0, keepdim=True)
        fake_feats = fake_feats / fake_feats.norm(dim=-1, keepdim=True)
        real_feats = real_feats / real_feats.norm(dim=-1, keepdim=True)

    img = torch.from_numpy(features).float().to(_device)
    sim_fake = (img @ fake_feats.T).item()
    sim_real = (img @ real_feats.T).item()
    score = (sim_fake - sim_real + 1) / 2
    return float(np.clip(score, 0.0, 1.0))


# ── Request / Response ────────────────────────────────────────────────────────

class DetectRequest(BaseModel):
    image: str                        # base64 data URL or raw base64
    filename: Optional[str] = "image.jpg"


class DetectResponse(BaseModel):
    isDeepfake: bool
    confidence: float
    score: float
    method: str
    anomalies: list[str]
    modelLoaded: bool


# ── Routes ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    load_models()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "clip_loaded": _clip_model is not None,
        "univfd_loaded": _univfd_probe is not None,
        "device": _device,
    }


@app.post("/detect", response_model=DetectResponse)
async def detect(req: DetectRequest):
    # Decode image
    try:
        data = req.image
        if data.startswith("data:"):
            data = data.split(",", 1)[1]
        image_bytes = base64.b64decode(data)
    except Exception as e:
        raise HTTPException(400, f"Invalid image data: {e}")

    load_models()

    if _clip_model is None:
        raise HTTPException(
            503,
            "CLIP not loaded. Run: pip install git+https://github.com/openai/CLIP.git"
        )

    features = get_clip_features(image_bytes)
    if features is None:
        raise HTTPException(500, "Feature extraction failed")

    score, method = univfd_score(features)
    is_fake = score > 0.5
    confidence = abs(score - 0.5) * 2

    anomalies = []
    if score > 0.85:
        anomalies.append("strong_ai_generation_signal")
    elif score > 0.65:
        anomalies.append("clip_features_suggest_synthetic")

    return DetectResponse(
        isDeepfake=is_fake,
        confidence=round(confidence, 4),
        score=round(score, 4),
        method=method,
        anomalies=anomalies,
        modelLoaded=_univfd_probe is not None,
    )
