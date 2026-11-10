"""
Modal.com deployment — free serverless hosting for the CLIP/UnivFD backend.

Free tier: 30 GB-hours/month compute, scales to zero when idle.
Cold start: ~5-10s (CLIP weights cached in Modal volume after first run).

Deploy:
    pip install modal
    modal deploy backend/modal_app.py

This gives you a public HTTPS URL like:
    https://your-username--deepfake-detect-api.modal.run

Set it in your .env:
    VITE_BACKEND_URL=https://your-username--deepfake-detect-api.modal.run
    VITE_BACKEND_SECRET=your-secret-key-here

Authentication:
    The backend requires a shared secret in the X-API-Key header to prevent abuse.
    Generate a random secret and set it in both .env files:
        Backend: BACKEND_SECRET=your-secret-key
        Frontend: VITE_BACKEND_SECRET=your-secret-key
"""

import io
import base64
import urllib.request
import os
from pathlib import Path
from typing import Optional

import modal

# ── Modal app setup ───────────────────────────────────────────────────────────

app = modal.App("deepfake-detect-api")

# Persistent volume — caches CLIP weights (~300 MB) so cold starts stay fast
volume = modal.Volume.from_name("deepfake-weights", create_if_missing=True)
WEIGHTS_DIR = Path("/weights")

# Container image with all deps
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")  # needed for pip install git+https://...
    .pip_install(
        "fastapi>=0.110.0",
        "torch",
        "torchvision",
        "pillow",
        "numpy",
        "open_clip_torch",  # for GRIP detector
        "huggingface-hub",  # for GRIP model loading
        "efficientnet-pytorch",  # for SBI detector
    )
    .run_commands(
        "pip install git+https://github.com/openai/CLIP.git"
    )
)

UNIVFD_URL = (
    "https://github.com/WisconsinAIVision/UniversalFakeDetect"
    "/raw/main/pretrained_weights/fc_weights.pth"
)

GRIP_URL = (
    "https://github.com/grip-unina/ClipBased-SyntheticImageDetection"
    "/raw/main/weights/clipdet_latent10k_plus/weights.pth"
)

# ── Inference class (loaded once per container) ───────────────────────────────

@app.cls(
    image=image,
    volumes={str(WEIGHTS_DIR): volume},
    cpu=2,
    memory=4096,  # CLIP ViT-L/14 needs ~2 GB RAM
    min_containers=0,  # scale to zero when idle — free tier friendly
)
class Detector:
    @modal.enter()
    def load(self):
        import torch
        import torch.nn as nn
        import clip
        import open_clip
        from huggingface_hub import hf_hub_download

        self.device = "cpu"
        print("Loading CLIP ViT-L/14...")
        self.clip_model, self.preprocess = clip.load("ViT-L/14", device=self.device)
        self.clip_model.eval()

        # Download UnivFD weights to persistent volume if not cached
        univfd_path = WEIGHTS_DIR / "fc_weights.pth"
        if not univfd_path.exists():
            print("Downloading UnivFD weights...")
            urllib.request.urlretrieve(UNIVFD_URL, univfd_path)
            volume.commit()

        self.univfd_probe = nn.Linear(768, 1)
        state = torch.load(str(univfd_path), map_location=self.device, weights_only=True)
        if isinstance(state, dict):
            self.univfd_probe.load_state_dict(state)
        else:
            self.univfd_probe.weight.data = state.float().reshape(1, 768)
            self.univfd_probe.bias.data = torch.zeros(1)
        self.univfd_probe.eval()

        # Load GRIP detector (reuses CLIP features!)
        print("Loading GRIP detector...")
        grip_path = WEIGHTS_DIR / "grip_clipdet.pth"
        if not grip_path.exists():
            print("Downloading GRIP weights...")
            urllib.request.urlretrieve(GRIP_URL, grip_path)
            volume.commit()

        # Load OpenCLIP backbone for GRIP (next-to-last layer features)
        self.grip_backbone = open_clip.create_model(
            "ViT-L-14",
            pretrained=hf_hub_download("laion/CLIP-ViT-L-14-CommonPool.XL-s13B-b90K", "open_clip_pytorch_model.bin")
        )
        # Remove projection to get next-to-last layer (768-dim instead of final projection)
        self.grip_backbone.visual.proj = None
        self.grip_backbone.eval()
        
        # GRIP classifier head (simple linear layer)
        self.grip_fc = nn.Linear(768, 1)
        grip_state = torch.load(str(grip_path), map_location=self.device)
        if 'model' in grip_state:
            # Extract just the fc layer weights
            fc_weights = {k.replace('fc.', ''): v for k, v in grip_state['model'].items() if k.startswith('fc.')}
            self.grip_fc.load_state_dict(fc_weights)
        else:
            self.grip_fc.load_state_dict(grip_state)
        self.grip_fc.eval()
        
        # GRIP preprocessing (224x224 center crop + CLIP normalization)
        from torchvision.transforms import Compose, Resize, CenterCrop, Normalize, InterpolationMode
        self.grip_preprocess = Compose([
            Resize(224, interpolation=InterpolationMode.BICUBIC),
            CenterCrop(224),
            Normalize(mean=(0.48145466, 0.4578275, 0.40821073), std=(0.26862954, 0.26130258, 0.27577711))
        ])
        
        # Load SBI detectors (EfficientNet-B4, two versions for robustness)
        print("Loading SBI face-swap detectors...")
        from efficientnet_pytorch import EfficientNet
        
        # SBI FFraw (trained on uncompressed)
        self.sbi_raw = EfficientNet.from_pretrained("efficientnet-b4", advprop=True, num_classes=2)
        sbi_raw_path = WEIGHTS_DIR / "sbi_ffraw.tar"
        if sbi_raw_path.exists():
            sbi_raw_state = torch.load(str(sbi_raw_path), map_location=self.device)
            self.sbi_raw.load_state_dict(sbi_raw_state["model"])
            self.sbi_raw.eval()
            print("  ✓ SBI FFraw loaded")
        else:
            print("  ⚠ SBI FFraw weights not found - face-swap detection disabled")
            self.sbi_raw = None
        
        # SBI FFc23 (trained on compressed, more robust)
        self.sbi_c23 = EfficientNet.from_pretrained("efficientnet-b4", advprop=True, num_classes=2)
        sbi_c23_path = WEIGHTS_DIR / "sbi_ffc23.tar"
        if sbi_c23_path.exists():
            sbi_c23_state = torch.load(str(sbi_c23_path), map_location=self.device)
            self.sbi_c23.load_state_dict(sbi_c23_state["model"])
            self.sbi_c23.eval()
            print("  ✓ SBI FFc23 loaded")
        else:
            print("  ⚠ SBI FFc23 weights not found")
            self.sbi_c23 = None
        
        # SBI preprocessing (EfficientNet-B4 expects 380x380)
        self.sbi_preprocess = Compose([
            Resize(380, interpolation=InterpolationMode.BILINEAR),
            CenterCrop(380),
        ])
        
        print("Ready: UnivFD + GRIP + SBI")

    def _features(self, image_bytes: bytes):
        import torch
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # UnivFD features (standard CLIP)
        inp = self.preprocess(img).unsqueeze(0).to(self.device)
        with torch.no_grad():
            univfd_feat = self.clip_model.encode_image(inp)
        
        # GRIP features (OpenCLIP next-to-last layer)
        from torchvision.transforms.functional import to_tensor
        grip_inp = to_tensor(img).unsqueeze(0).to(self.device)
        grip_inp = self.grip_preprocess(grip_inp)
        with torch.no_grad():
            grip_feat = self.grip_backbone.encode_image(grip_inp, normalize=True)
        
        # SBI preprocessing (380x380, normalized to 0-1)
        sbi_inp = self.sbi_preprocess(img)
        sbi_tensor = to_tensor(sbi_inp).unsqueeze(0).to(self.device)  # Already 0-1 range
        
        return univfd_feat, grip_feat, sbi_tensor

    def _scores(self, univfd_features, grip_features, sbi_input) -> dict:
        import torch
        with torch.no_grad():
            # UnivFD score (sigmoid probability)
            univfd_logit = self.univfd_probe(univfd_features.float())
            univfd_prob = torch.sigmoid(univfd_logit).item()
            
            # GRIP score (raw logit where >0 means synthetic)
            grip_logit = self.grip_fc(grip_features.float()).item()
            grip_prob = torch.sigmoid(torch.tensor(grip_logit)).item()
            
            # SBI scores (softmax probabilities, class 1 = fake)
            sbi_scores = []
            if self.sbi_raw is not None:
                sbi_raw_out = self.sbi_raw(sbi_input)
                sbi_raw_prob = torch.softmax(sbi_raw_out, dim=1)[0, 1].item()
                sbi_scores.append(sbi_raw_prob)
            
            if self.sbi_c23 is not None:
                sbi_c23_out = self.sbi_c23(sbi_input)
                sbi_c23_prob = torch.softmax(sbi_c23_out, dim=1)[0, 1].item()
                sbi_scores.append(sbi_c23_prob)
            
            # Average SBI scores if both available
            sbi_prob = sum(sbi_scores) / len(sbi_scores) if sbi_scores else None
        
        return {
            "univfd": float(univfd_prob),
            "grip": float(grip_prob),
            "grip_logit": float(grip_logit),
            "sbi": float(sbi_prob) if sbi_prob is not None else None,
        }

    @modal.method()
    def detect(self, image_b64: str, filename: str = "image.jpg") -> dict:
        import numpy as np

        data = image_b64
        if data.startswith("data:"):
            data = data.split(",", 1)[1]
        image_bytes = base64.b64decode(data)

        univfd_feat, grip_feat, sbi_inp = self._features(image_bytes)
        scores = self._scores(univfd_feat, grip_feat, sbi_inp)
        
        # Three-detector ensemble with learned weights
        # UnivFD: 0.4 (GANs specialist)
        # GRIP: 0.35 (Diffusion specialist)
        # SBI: 0.25 (Face-swap specialist)
        parts = [
            (scores["univfd"], 0.4),
            (scores["grip"], 0.35),
        ]
        if scores["sbi"] is not None:
            parts.append((scores["sbi"], 0.25))
        
        # Weighted average
        total_weight = sum(w for _, w in parts)
        ensemble_score = sum(s * w for s, w in parts) / total_weight
        
        is_fake = ensemble_score > 0.5
        confidence = abs(ensemble_score - 0.5) * 2

        anomalies = []
        if scores["univfd"] > 0.85:
            anomalies.append("univfd_strong_gan_signal")
        elif scores["univfd"] > 0.65:
            anomalies.append("univfd_moderate_gan_signal")
        
        if scores["grip_logit"] > 2.0:
            anomalies.append("grip_strong_diffusion_signal")
        elif scores["grip_logit"] > 0:
            anomalies.append("grip_diffusion_detected")
        
        if scores["sbi"] is not None:
            if scores["sbi"] > 0.85:
                anomalies.append("sbi_strong_faceswap_signal")
            elif scores["sbi"] > 0.65:
                anomalies.append("sbi_faceswap_detected")

        result = {
            "isDeepfake": is_fake,
            "confidence": round(confidence, 4),
            "score": round(ensemble_score, 4),
            "univfd_score": round(scores["univfd"], 4),
            "grip_score": round(scores["grip"], 4),
            "grip_logit": round(scores["grip_logit"], 4),
            "method": "univfd+grip+sbi",
            "anomalies": anomalies,
            "modelLoaded": True,
        }
        
        if scores["sbi"] is not None:
            result["sbi_score"] = round(scores["sbi"], 4)
        
        return result


# ── FastAPI wrapper (same interface as local backend) ─────────────────────────

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("deepfake-backend-secret")],
)
@modal.asgi_app()
def fastapi_app():
    from fastapi import Depends, FastAPI, HTTPException, Header
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    web_app = FastAPI(title="Deepfake Detection API")
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["POST", "GET"],
        allow_headers=["*"],
    )

    # Get secret from Modal secret or environment variable
    BACKEND_SECRET = os.environ.get("BACKEND_SECRET")
    if not BACKEND_SECRET:
        print("WARNING: BACKEND_SECRET not set — authentication disabled!")

    def verify_auth(x_api_key: Optional[str] = Header(None)):
        """Verify the shared secret header to prevent abuse.

        Used as a FastAPI dependency via Depends() so the X-API-Key header
        is automatically extracted and injected by FastAPI.
        """
        if not BACKEND_SECRET:
            return  # Auth disabled if no secret configured
        if not x_api_key or x_api_key != BACKEND_SECRET:
            raise HTTPException(
                status_code=401,
                detail="Invalid or missing X-API-Key header"
            )

    class DetectRequest(BaseModel):
        image: str
        filename: Optional[str] = "image.jpg"

    @web_app.get("/health")
    def health():
        return {
            "status": "ok",
            "clip_loaded": True,
            "univfd_loaded": True,
            "grip_loaded": True,
            "sbi_loaded": True,
            "auth_enabled": BACKEND_SECRET is not None,
        }

    @web_app.post("/detect")
    def detect(req: DetectRequest, _auth=Depends(verify_auth)):
        detector = Detector()
        return detector.detect.remote(req.image, req.filename or "image.jpg")

    return web_app
