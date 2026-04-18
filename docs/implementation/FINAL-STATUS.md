# Implementation Complete — Final Status
**Last Updated**: April 2026
**Branch**: modelenhancement (active)

---

## System Overview

A production-grade multi-modal deepfake detection web application. Detects face-swap deepfakes, AI-generated images, and manipulated video using an ensemble of 5+ ML models running in the browser, backed by a CLIP-based server for generalization to unseen generators.

---

## Detection Stack (current)

### Group A — Face Manipulation (55% ensemble weight)
| Model | Format | Accuracy | Notes |
|---|---|---|---|
| ViT-Deepfake-Exp | ONNX (343 MB) | 98.8% | Best single model, weight 3.0× |
| ViT-Deepfake-v2 | ONNX (343 MB) | 92.1% | Different training set, weight 2.0× |
| DeepfakeDetector | ONNX (95 MB) | ~90% | Face swaps, weight 1.5× |
| MesoNet4 | TF.js (0.1 MB) | ~90% | Classic face swaps, weight 1.0× |

### Group B — AI-Generated Content (35% ensemble weight)
| Model | Format | Accuracy | Notes |
|---|---|---|---|
| SwinV2-AI-Detector | ONNX (307 MB) | 98.1% | SD, DALL-E, Midjourney, Firefly |
| CLIP/UnivFD | Backend (300 MB) | Generalizes | Unseen generators, Modal.com |

### Group C — Forensic Signals (10% ensemble weight)
| Signal | Weight | Notes |
|---|---|---|
| Temporal Consistency | 3.0× | 8-frame sliding window, variance + flip rate |
| PPG Blood-Flow | 2.5× | Intel FakeCatcher approach, video/webcam only |
| Lip-Sync | 2.5× | Phoneme onset correlation (not just RMS energy) |
| Voice Artifacts | 2.0× | Spectral FFT analysis |
| Metadata Forensics | 1.0× | Timestamps, AI-common resolutions, codecs |

All ONNX models hosted on Hugging Face (`stino214/deepfake-onnx-models`), fetched at runtime, cached in IndexedDB after first download.

---

## Accuracy Improvements Applied (April 2026)

| Improvement | Impact |
|---|---|
| Center-crop before ViT inference | Preserves face geometry, direct accuracy gain |
| Face alignment (eye-horizontal rotation) | Matches ViT training distribution, further accuracy gain |
| Face localization (bbox from face detector) | ViT sees cropped face on images too, not just video |
| IndexedDB model caching | No re-download on repeat visits (~1.1 GB saved) |
| COOP/COEP headers (vite + vercel.json) | Multi-threaded WASM, 3-5× faster inference |
| Phoneme onset lip-sync (spectral flux + ZCR) | Catches dubbed content RMS proxy missed |
| Temporal consistency sliding window | Catches flickering artifacts frame models miss |
| Temporal analyzer reset between uploads | Prevents cross-video window contamination |
| PPG gated to video/webcam only | Eliminates noise from single-image PPG |
| Voice analyzer multi-signal requirement | Reduces false positives on legitimate audio |
| Lazy-loaded detection components | ML libraries only load on /detection route |
| UnivFD fine-tuning script | `scripts/finetune_univfd.py` for custom data |
| Ensemble weight calibration script | `scripts/calibrate_weights.py` for test-set optimization |

---

## Architecture

```
Browser
├── Detection Pipeline
│   ├── MediaPipe face detection → bounding box
│   ├── MediaPipe face mesh → 468 landmarks → feature extraction
│   ├── Face crop (from landmarks bbox) → passed to ONNX models
│   ├── ONNX Runtime Web (Group A + B models, IndexedDB cached)
│   ├── TensorFlow.js (MesoNet4, texture heuristic)
│   ├── Temporal consistency (8-frame sliding window)
│   ├── PPG analyzer (video/webcam only, 30+ frames needed)
│   ├── Lip-sync analyzer (phoneme onset correlation)
│   ├── Voice analyzer (spectral FFT)
│   └── Metadata forensics
├── Ensemble combiner (grouped weighted average + strong signal override)
└── Audit logger → Supabase

Backend (Modal.com, optional)
└── FastAPI → CLIP ViT-L/14 → UnivFD linear probe → score

Database (Supabase)
└── audit_logs (RLS — users see only their own)
```

---

## File Structure (key files)

```
src/lib/
├── onnx/
│   ├── onnxDetector.ts        # HF model loading, IndexedDB cache, center-crop
│   └── faceLocalizer.ts       # Crop canvas to face bbox before ViT
├── tensorflow/
│   └── detector.ts            # Ensemble logic, multi-modal combiner
├── temporal/
│   └── temporalConsistency.ts # 8-frame sliding window analyzer
├── audio/
│   ├── lipSyncAnalyzer.ts     # Phoneme onset correlation
│   └── voiceAnalyzer.ts       # Spectral FFT voice artifacts
├── physiological/
│   └── ppgAnalyzer.ts         # PPG blood-flow (video/webcam only)
├── forensics/
│   ├── metadataAnalyzer.ts    # File/video metadata checks
│   └── elaAnalyzer.ts         # Error Level Analysis
├── mediapipe/                 # Face detection, mesh, feature extraction
└── api/
    └── univfdClient.ts        # CLIP backend client

scripts/
├── finetune_univfd.py         # Fine-tune UnivFD probe on custom deepfake data
└── calibrate_weights.py       # Optimize ensemble group weights on labeled test set
```

---

## Deployment

| Layer | Platform | Status |
|---|---|---|
| Frontend | Vercel | ✅ Auto-deploys on push |
| Backend | Modal.com (free tier) | ✅ Live, scales to zero |
| Database | Supabase | ✅ Live |
| Models | Hugging Face CDN | ✅ Live (`stino214/deepfake-onnx-models`) |

---

## Known Limitations

- ONNX models are large (1.1 GB total) — first load takes time depending on connection. Subsequent loads are instant via IndexedDB cache.
- PPG requires 30+ frames (~1 second at 30fps) — not useful for single images.
- CLIP backend has ~10s cold start on Modal.com free tier after idle period.
- No detector handles adversarially crafted deepfakes well — this is an open research problem.
- UnivFD probe was trained on 2020 GAN data. Fine-tune with `scripts/finetune_univfd.py` for better video deepfake accuracy.
