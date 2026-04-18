# Detection System Guide

Complete technical reference for the deepfake detection pipeline.

---

## Architecture Overview

```
User Input (image / video / webcam)
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                  BROWSER (always runs)               │
│                                                      │
│  Group A — Face Manipulation                         │
│  ┌──────────────────────────────────────────────┐   │
│  │ ViT-Deepfake-Exp   98.8%  weight 3.0×        │   │
│  │ ViT-Deepfake-v2    92.1%  weight 2.0×        │   │
│  │ DeepfakeDetector   ~90%   weight 1.5×        │   │
│  │ MesoNet4           ~90%   weight 1.0×        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Group B — AI-Generated Content                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ SwinV2-AI-Detector 98.1%  weight 2.0×        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Group C — Forensic Signals                          │
│  ┌──────────────────────────────────────────────┐   │
│  │ PPG (heartbeat)  │ ELA forensics             │   │
│  │ Metadata         │ Lip-sync (video)          │   │
│  │ Voice artifacts  │ Landmark features         │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│           CLIP BACKEND (Modal.com, optional)         │
│                                                      │
│  CLIP ViT-L/14 + UnivFD linear probe                │
│  Best generalization to unseen generators            │
│  (DALL-E 3, Midjourney v7, FLUX, future models)     │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                  ENSEMBLE COMBINER                   │
│                                                      │
│  Group A score × 0.55                               │
│  Group B score × 0.35  (includes CLIP if available) │
│  Group C score × 0.10                               │
│                                                      │
│  + Strong signal override: if any model > 92%,      │
│    blend it in at 40% weight                        │
└─────────────────────────────────────────────────────┘
         │
         ▼
    Final verdict + per-model scores + anomalies
```

---

## Model Details

### ViT-Deepfake-Exp (98.8% accuracy)
- Architecture: ViT-base-patch16-224 (Google)
- Training: Fine-tuned on deepfake face dataset
- Input: 224×224, ImageNet normalization
- Output: [Deepfake_logit, Real_logit] — fakeIndex=0
- Source: prithivMLmods/Deepfake-Detection-Exp-02-21-ONNX
- Weight in ensemble: 3.0× (highest — best accuracy)

### ViT-Deepfake-v2 (92.1% accuracy)
- Architecture: ViT-base-patch16-224
- Training: Different dataset from Exp — adds diversity to ensemble
- Input: 224×224, ImageNet normalization
- Output: [Realism_logit, Deepfake_logit] — fakeIndex=1
- Source: onnx-community/Deep-Fake-Detector-v2-Model-ONNX
- Weight in ensemble: 2.0×

### SwinV2 AI Detector (98.1% accuracy)
- Architecture: SwinV2 (Microsoft)
- Training: Real photos vs AI-generated (SD, DALL-E, Midjourney, Firefly)
- Input: 224×224, ImageNet normalization (int8 quantized)
- Output: [artificial_logit, real_logit] — fakeIndex=0
- Source: LPX55/detection-model-1-ONNX (based on haywoodsloan/ai-image-detector-deploy)
- Weight in ensemble: 2.0×

### DeepfakeDetector-ONNX
- Architecture: Unknown (LPX55 community model)
- Training: Face-swap deepfakes
- Input: 224×224, ImageNet normalization, single sigmoid output
- Source: LPX55/deepfake_detectors-onnx model 03
- Weight in ensemble: 1.5×

### MesoNet4
- Architecture: Custom shallow CNN (Afchar et al. 2018)
- Training: Classic face-swap deepfakes
- Input: 256×256, [0,1] normalization
- Format: TensorFlow.js LayersModel
- Source: Included in `/public/models/mesonet/`
- Weight in ensemble: 1.0× (baseline)

### CLIP/UnivFD Backend
- Architecture: CLIP ViT-L/14 (OpenAI) + linear probe
- Training: UnivFD probe trained on GAN images, generalizes to diffusion
- Why it works: CLIP's feature space separates real from synthetic in a way that transfers to unseen generators
- Hosted: Modal.com serverless (free tier)
- Weight in final combiner: 35% of Group B

---

## Ensemble Logic

### Why grouped voting instead of flat average?

A flat weighted average has a problem: if you have 4 face-swap models and 1 AI-art model, the face-swap models dominate even when the input is a DALL-E image. Grouped voting fixes this — each specialty gets a fair vote regardless of how many models cover it.

### The groups

**Group A (face manipulation)** — runs all face-specific models, takes their weighted average. Gets 55% of the final score because face manipulation is the most common deepfake type.

**Group B (AI-generated content)** — SwinV2 + CLIP backend. Gets 35% because AI-generated images are increasingly common and these models are highly accurate on them.

**Group C (forensic signals)** — PPG, ELA, metadata, etc. Gets 10% because these are heuristics, not trained classifiers. They add signal but shouldn't dominate.

### Strong signal override

If any single model scores >92%, it gets blended in at 40% weight on top of the group result. This handles cases where one model is extremely confident — you don't want the ensemble to dilute a near-certain detection.

### Adaptive weights

If a group has no available models (e.g., backend offline), its weight redistributes proportionally to the other groups. The system always produces a result.

---

## Per-Analyzer Behavior

### ImageAnalyzer
1. Load image → draw to canvas
2. OpenCV preprocessing
3. MediaPipe face detection + mesh
4. Run `detectMultiModal` with: imageData, faceMesh, canvas, file, UnivFD result
5. UnivFD called in parallel with visual analysis (not sequential)
6. ELA forensics run separately, anomalies merged in
7. Result displayed with per-model score breakdown

### VideoAnalyzer
1. Extract audio buffer for lip-sync/voice
2. Extract frames at configurable interval (0.25s / 0.5s / 1.0s)
3. UnivFD called once on first frame (file-level signal, no need to repeat)
4. Each frame: face mesh → `detectMultiModal` with audio + UnivFD (first frame only)
5. Temporal consistency score calculated across frames
6. Suspicious segments identified and shown on timeline

### WebcamDetector
1. Continuous frame loop via `requestAnimationFrame`
2. Face detection + mesh every frame
3. `detectMultiModal` called at configurable interval (200ms / 100ms / 50ms)
4. UnivFD called at most once every 10 seconds (CLIP is ~1-2s, too slow for every frame)
5. Canvas overlay drawn with bounding box + landmarks + confidence badge

---

## ONNX Runtime Configuration

WASM paths served from jsDelivr CDN:
```
https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/
```

Required Vite headers (set in `vite.config.ts`):
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These are required for WASM multi-threading. Without them, ONNX Runtime falls back to single-threaded mode which is significantly slower.

Models load in parallel on first `initOnnxDetector()` call. Local files tried first, remote HuggingFace URLs as fallback.

---

## Backend API

### Endpoints

`GET /health`
```json
{ "status": "ok", "clip_loaded": true, "univfd_loaded": true, "device": "cpu" }
```

`POST /detect`
```json
// Request
{ "image": "data:image/jpeg;base64,...", "filename": "image.jpg" }

// Response
{
  "isDeepfake": true,
  "confidence": 0.84,
  "score": 0.92,
  "method": "univfd",
  "anomalies": ["strong_ai_generation_signal"],
  "modelLoaded": true
}
```

### Why Modal.com?

- Free tier: 30 GB-hours/month compute
- Scales to zero when idle (no cost when not in use)
- CLIP weights cached in Modal Volume after first run
- Cold start: ~10s (CLIP model download + load)
- Warm: ~1-2s per request

### Fallback behavior

The frontend checks backend availability on first request and caches the result. If the backend is offline or cold-starting, the app continues with browser-only models. `resetBackendCache()` can be called to retry.

---

## Adding New Models

To add a new ONNX model:

1. Add entry to `MODELS` in `src/lib/onnx/onnxDetector.ts`:
```typescript
myModel: {
  local: '/models/onnx/my_model.onnx',
  remote: 'https://huggingface.co/.../model.onnx',
  inputSize: 224,
  norm: 'imagenet',  // or 'neg1to1'
  fakeIndex: 1,      // which output index = fake, or -1 for sigmoid
  weight: 1.5,
}
```

2. Add to `OnnxDetectionResult` interface
3. Assign to a group in `detectFromImage` in `detector.ts`
4. Add to download script `scripts/download_onnx_models.ps1`
