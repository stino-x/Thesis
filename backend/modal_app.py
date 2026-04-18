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
    )
    .run_commands(
        "pip install git+https://github.com/openai/CLIP.git"
    )
)

UNIVFD_URL = (
    "https://github.com/WisconsinAIVision/UniversalFakeDetect"
    "/raw/main/pretrained_weights/fc_weights.pth"
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
        import clip

        self.device = "cpu"
        print("Loading CLIP ViT-L/14...")
        self.clip_model, self.preprocess = clip.load("ViT-L/14", device=self.device)
        self.clip_model.eval()

        # Download UnivFD weights to persistent volume if not cached
        weights_path = WEIGHTS_DIR / "fc_weights.pth"
        if not weights_path.exists():
            print("Downloading UnivFD weights...")
            urllib.request.urlretrieve(UNIVFD_URL, weights_path)
            volume.commit()

        import torch.nn as nn
        self.probe = nn.Linear(768, 1)
        state = torch.load(str(weights_path), map_location=self.device, weights_only=True)
        if isinstance(state, dict):
            self.probe.load_state_dict(state)
        else:
            self.probe.weight.data = state.float().reshape(1, 768)
            self.probe.bias.data = torch.zeros(1)
        self.probe.eval()
        print("Ready.")

    def _features(self, image_bytes: bytes):
        import torch
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        inp = self.preprocess(img).unsqueeze(0).to(self.device)
        with torch.no_grad():
            f = self.clip_model.encode_image(inp)
            f = f / f.norm(dim=-1, keepdim=True)
        return f

    def _score(self, features) -> tuple[float, str]:
        import torch
        with torch.no_grad():
            logit = self.probe(features.float())
            prob = torch.sigmoid(logit).item()
        return float(prob), "univfd"

    @modal.method()
    def detect(self, image_b64: str, filename: str = "image.jpg") -> dict:
        import numpy as np

        data = image_b64
        if data.startswith("data:"):
            data = data.split(",", 1)[1]
        image_bytes = base64.b64decode(data)

        features = self._features(image_bytes)
        score, method = self._score(features)
        is_fake = score > 0.5
        confidence = abs(score - 0.5) * 2

        anomalies = []
        if score > 0.85:
            anomalies.append("strong_ai_generation_signal")
        elif score > 0.65:
            anomalies.append("clip_features_suggest_synthetic")

        return {
            "isDeepfake": is_fake,
            "confidence": round(confidence, 4),
            "score": round(score, 4),
            "method": method,
            "anomalies": anomalies,
            "modelLoaded": True,
        }


# ── FastAPI wrapper (same interface as local backend) ─────────────────────────

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("deepfake-backend-secret")],
)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI, HTTPException, Header
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
        """Verify the shared secret header to prevent abuse"""
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
            "auth_enabled": BACKEND_SECRET is not None,
        }

    @web_app.post("/detect")
    def detect(req: DetectRequest, _auth=None):
        # Verify auth first
        if BACKEND_SECRET:
            verify_auth(_auth)
        detector = Detector()
        return detector.detect.remote(req.image, req.filename or "image.jpg")

    return web_app
