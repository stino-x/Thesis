# Quick Start

## 1. Install dependencies

```bash
npm install
```

## 2. Set up environment

```bash
cp .env.example .env
```

Fill in your Supabase credentials. The Modal backend URL is already set.

## 3. Download ONNX models

Models are not in git (too large). Run once:

```powershell
.\scripts\download_onnx_models.ps1
```

Downloads ~600 MB to `public/models/onnx/`. MesoNet is already included in the repo.

## 4. Run

```bash
npm run dev
```

Open `http://localhost:5173`

---

## Optional: Run backend locally

The CLIP backend is already deployed to Modal and set in `.env`. If you want to run it locally instead:

```bash
# Backend uses the scripts/.venv312 Python environment
scripts/.venv312/Scripts/uvicorn backend.main:app --reload --port 8787
```

Then change `VITE_BACKEND_URL=http://localhost:8787` in `.env`.

---

## What to expect on first load

1. App loads, ONNX models start initializing in background
2. Console shows: `✅ ONNX vitDeepfakeExp loaded`, etc.
3. First detection may be slow (~2-3s) while models warm up
4. Backend health check runs — if Modal is cold, first CLIP call takes ~10s

---

## Testing the detection

Good test images:
- Any image from Midjourney, DALL-E, or Stable Diffusion → should flag as AI-generated
- A real photo taken on your phone → should come back clean
- A known deepfake video → should flag suspicious frames

The score breakdown in results shows which models fired and at what confidence.
