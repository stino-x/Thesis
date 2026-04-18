# Developer Guide

## Repository Layout

```
deepfake-app/
├── src/                        # React frontend
│   ├── components/detection/   # Three analyzers (image, video, webcam)
│   ├── lib/
│   │   ├── onnx/               # ONNX Runtime Web inference
│   │   ├── tensorflow/         # TF.js models + ensemble logic
│   │   ├── api/                # Backend client (UnivFD/CLIP)
│   │   ├── mediapipe/          # Face detection, mesh, features
│   │   ├── forensics/          # ELA + metadata
│   │   ├── physiological/      # PPG heartbeat analysis
│   │   └── audio/              # Lip-sync + voice
│   ├── contexts/               # Auth + Settings React contexts
│   ├── hooks/                  # useAuditLog, useAuth, useSettings
│   ├── pages/                  # Route-level components
│   └── types/                  # Shared TypeScript types
├── backend/
│   ├── main.py                 # FastAPI server (local dev)
│   └── modal_app.py            # Modal.com deployment
├── public/models/
│   ├── mesonet/                # TF.js weights (in git)
│   └── onnx/                   # ONNX models (gitignored, download via script)
└── scripts/
    ├── download_onnx_models.ps1
    ├── export_to_onnx.py
    └── .venv312/               # Python 3.12 venv (gitignored)
```

---

## Key Files

### `src/lib/onnx/onnxDetector.ts`
The ONNX model registry and inference engine. Defines all 4 ONNX models with their weights, input sizes, normalization modes, and fake class indices. `detectWithOnnx()` runs all loaded models in parallel and returns per-model scores.

### `src/lib/tensorflow/detector.ts`
The main ensemble logic. `DeepfakeDetector` class loads TF.js models (MesoNet, XceptionNet, CNNDetector, MobileNet) and orchestrates the full detection pipeline. `detectFromImage()` implements the grouped ensemble. `detectMultiModal()` combines visual + physiological + audio + metadata + CLIP results.

### `src/lib/api/univfdClient.ts`
HTTP client for the CLIP backend. Checks availability once and caches the result. `detectFileWithUnivFD()` sends a base64 image and returns the CLIP score. Falls back silently when backend is offline.

### `src/components/detection/ImageAnalyzer.tsx`
Orchestrates the full image analysis pipeline: OpenCV preprocessing → face detection → face mesh → `detectMultiModal` (with UnivFD in parallel) → ELA → display results.

---

## Running Locally

```bash
# Frontend
npm install
npm run dev

# Backend (optional — Modal deployment is already live)
scripts/.venv312/Scripts/uvicorn backend.main:app --reload --port 8787
```

---

## Adding a New ONNX Model

1. Find a model on HuggingFace with an ONNX export
2. Check its config.json for `id2label` to know which index = fake
3. Add to `MODELS` in `src/lib/onnx/onnxDetector.ts`
4. Add to `OnnxDetectionResult` interface
5. Assign to a group in `detectFromImage` in `detector.ts`
6. Add download URL to `scripts/download_onnx_models.ps1`

---

## Modifying Ensemble Weights

Group weights are in `combineMultiModalResults` in `detector.ts`:
```typescript
if (visualScore !== null)   parts.push([visualScore,  0.50]);
if (univfdScore !== null)   parts.push([univfdScore,  0.35]);
if (forensicScore !== null) parts.push([forensicScore, 0.15]);
```

Per-model weights within groups are in `detectFromImage`:
```typescript
groupA.push([onnx.vitDeepfakeExp.score, 3.0]); // adjust here
```

---

## Deploying the Backend

```bash
# First time
pip install modal
modal setup  # authenticate with GitHub

# Deploy
modal deploy backend/modal_app.py
```

The deploy output gives you the public URL. Update `VITE_BACKEND_URL` in `.env`.

---

## Supabase Setup

The app uses Supabase for auth and audit logs. Required tables:

```sql
-- Run in Supabase SQL editor
create table audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  detection_type text,
  media_type text,
  file_name text,
  file_size bigint,
  detection_result text,
  confidence_score float,
  processing_time_ms int,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table audit_logs enable row level security;
create policy "Users see own logs" on audit_logs
  for all using (auth.uid() = user_id);
```

---

## Git Workflow

Current branch: `modelenhancement`

Untracked files that need staging:
- `backend/` — FastAPI server + Modal deployment
- `scripts/` — model download/conversion scripts
- `src/lib/api/` — UnivFD client
- `src/lib/onnx/` — ONNX detector

```bash
git add backend/ scripts/ src/lib/api/ src/lib/onnx/
git add -u  # stage all modified tracked files
git commit -m "feat: add ONNX ensemble, CLIP backend, Modal deployment"
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_BACKEND_URL` | No | CLIP backend URL (defaults to localhost:8787) |
| `VITE_SITE_URL` | No | Site URL for auth redirects |
