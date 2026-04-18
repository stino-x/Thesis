# Deepfake Detection System

A production-grade multi-modal deepfake detection web application. Detects AI-generated images, face-swap deepfakes, and manipulated media using an ensemble of 5+ ML models running directly in the browser, backed by a CLIP-based server for generalization to unseen generators.

## What It Does

- Upload an image, video, or use your webcam
- The system runs every available detection method simultaneously
- Results are combined into a single verdict with per-model score breakdown
- Works offline (browser models) — CLIP backend adds coverage for newest generators

---

## Detection Stack

### In-Browser Models (always run, no server needed)

| Model | Accuracy | Detects | Size |
|---|---|---|---|
| SwinV2 AI Detector | 98.1% | SD, DALL-E, Midjourney, Firefly | 307 MB |
| ViT Deepfake Exp | 98.8% | Face deepfakes (best single model) | 343 MB |
| ViT Deepfake v2 | 92.1% | Face deepfakes (different training set) | 343 MB |
| DeepfakeDetector-ONNX | ~90% | Face swaps | 95 MB |
| MesoNet4 | ~90% | Classic face swaps | 0.1 MB |

All ONNX models run via ONNX Runtime Web (WASM). Models are hosted on Hugging Face (`stino214/deepfake-onnx-models`) and fetched at runtime — not bundled with the app.

### Backend (CLIP/UnivFD — hosted free on Modal.com)

CLIP ViT-L/14 + UnivFD linear probe. The only open-source approach that generalizes to **unseen generators** — DALL-E 3, Midjourney v7, FLUX, and future models it was never trained on. Runs on Modal.com serverless (free tier, ~10s cold start).

### Multi-Modal Forensic Signals (layered on top)

- **PPG Analysis** — detects absence of heartbeat signal in skin pixels (Intel FakeCatcher approach)
- **ELA Forensics** — Error Level Analysis for compression artifact inconsistencies
- **Metadata Forensics** — file timestamps, AI-typical resolutions, codec mismatches
- **Lip-Sync Analysis** — mouth movement vs audio correlation (video only)
- **Voice Analysis** — spectral artifacts in synthetic speech (video only)
- **MediaPipe Landmarks** — blink rate, eye aspect ratio, face symmetry, landmark jitter

### Ensemble Strategy

Models are grouped by specialty, each group votes independently:

- **Group A** (face manipulation, 55% weight): ViT-Exp, ViT-v2, DeepfakeDetector, MesoNet
- **Group B** (AI-generated content, 35% weight): SwinV2 + CLIP/UnivFD backend
- **Group C** (forensic signals, 10% weight): Temporal consistency, PPG, ELA, metadata, lip-sync, voice

A single model at >92% confidence triggers a boost override. Everything degrades gracefully when models are unavailable.

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.12 (for scripts/backend, already set up in `scripts/.venv312`)

### Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

### Download ONNX Models

Models are hosted on Hugging Face and fetched automatically at runtime — no download needed. If you want local copies for offline development:

```powershell
.\scripts\download_onnx_models.ps1
```

This downloads all 4 ONNX models (~1.1 GB total) to `public/models/onnx/` (gitignored).

### Backend (optional — already deployed to Modal)

The CLIP backend is live at:
```
https://austindev214--deepfake-detect-api-fastapi-app.modal.run
```

It's already set in `.env`. To run locally instead:

```bash
scripts/.venv312/Scripts/uvicorn backend.main:app --reload --port 8787
```

To redeploy to Modal:

```bash
pip install modal
modal deploy backend/modal_app.py
```

---

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── detection/
│   │   │   ├── ImageAnalyzer.tsx      # Image upload + analysis
│   │   │   ├── VideoAnalyzer.tsx      # Video frame-by-frame analysis
│   │   │   └── WebcamDetector.tsx     # Real-time webcam detection
│   │   └── ui/                        # Shadcn UI components
│   ├── lib/
│   │   ├── onnx/
│   │   │   ├── onnxDetector.ts        # ONNX Runtime Web — 4 models, IndexedDB cache
│   │   │   └── faceLocalizer.ts       # Crop face region before ViT inference
│   │   ├── tensorflow/detector.ts     # Ensemble logic + TFJS models
│   │   ├── temporal/                  # 8-frame sliding window consistency
│   │   ├── api/univfdClient.ts        # CLIP backend client
│   │   ├── mediapipe/                 # Face detection + mesh + features
│   │   ├── forensics/                 # ELA + metadata analysis
│   │   ├── physiological/             # PPG heartbeat analysis (video/webcam only)
│   │   └── audio/                     # Lip-sync (phoneme onset) + voice analysis
│   └── pages/
│       ├── Detection.tsx              # Main detection page
│       ├── AuditLogsPage.tsx          # Detection history
│       └── Profile.tsx                # User profile
├── backend/
│   ├── main.py                        # FastAPI + CLIP/UnivFD (local)
│   └── modal_app.py                   # Modal.com deployment
├── public/models/
│   ├── mesonet/                       # MesoNet4 TF.js weights (included)
│   └── onnx/                          # ONNX models (download via script)
└── scripts/
    ├── download_onnx_models.ps1       # Download all ONNX models locally
    ├── finetune_univfd.py             # Fine-tune UnivFD probe on custom data
    ├── export_to_onnx.py              # Export XceptionNet/CNNDetector to ONNX
    └── .venv312/                      # Python venv (gitignored)
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
VITE_SUPABASE_URL=           # Supabase project URL
VITE_SUPABASE_ANON_KEY=      # Supabase anon key
VITE_BACKEND_URL=https://austindev214--deepfake-detect-api-fastapi-app.modal.run
```

---

## Authentication

Supabase Auth with email/password + OAuth (Google, GitHub). Protected routes redirect to login. Audit logs stored in Supabase PostgreSQL with Row-Level Security.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| UI | Shadcn/ui + Tailwind CSS + Framer Motion |
| In-browser ML | TensorFlow.js + ONNX Runtime Web |
| Face tracking | MediaPipe Tasks Vision |
| Backend ML | FastAPI + PyTorch + CLIP (Modal.com) |
| Auth + DB | Supabase |
| State | React Query + Context API |

---

## Browser Requirements

- Chrome/Edge recommended (best WASM performance)
- Firefox supported
- Requires `Cross-Origin-Opener-Policy: same-origin` headers (set in `vite.config.ts`) for ONNX WASM threading

---

## Honest Limitations

No open-source detector catches everything. Research shows even SOTA models drop ~45% AUC on real-world 2024 deepfakes vs lab benchmarks. This system covers:

- Classic face swaps — very well (MesoNet, ViT models)
- GAN-generated faces — well (SwinV2)
- Known diffusion models (SD, DALL-E 2) — well (SwinV2 + CLIP)
- Newest generators (DALL-E 3, MJ v7, FLUX) — best available open-source (CLIP/UnivFD)
- Adversarially crafted deepfakes — limited (no detector handles these well)

The multi-modal stack (PPG, ELA, lip-sync) adds signals that are hard to fake even when visual models fail.
