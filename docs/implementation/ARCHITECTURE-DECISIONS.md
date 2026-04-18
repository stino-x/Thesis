# Architecture Decisions

Every significant decision made during development, with the reasoning behind it.

---

## 1. Why ONNX Runtime Web instead of TensorFlow.js for new models

**Decision:** New models (ViT, SwinV2) run via ONNX Runtime Web. Older models (MesoNet) stay in TF.js.

**Why:** The best available deepfake detection models on HuggingFace are exported in ONNX format. Converting them to TF.js requires a PyTorch → ONNX → TF SavedModel → TFJS chain that introduces accuracy loss and compatibility issues. ONNX Runtime Web runs ONNX models natively in the browser via WASM, with no conversion needed. The tradeoff is that ONNX Runtime requires specific CORS headers (`COOP/COEP`) for WASM threading — handled in `vite.config.ts`.

---

## 2. Why grouped ensemble voting instead of flat weighted average

**Decision:** Models are split into Group A (face manipulation), Group B (AI-generated), Group C (forensic), each voting independently before combining.

**Why:** A flat average has a dilution problem. If you have 4 face-swap models and 1 AI-art model, the face-swap models dominate even when analyzing a DALL-E image. Grouped voting gives each specialty a fair vote. It also makes weights more interpretable — "Group B gets 35%" is clearer than trying to balance 5 individual model weights against each other.

The group weights (55/35/10) reflect the relative reliability of each category: trained ML models are more reliable than forensic heuristics, and face manipulation is the most common threat.

---

## 3. Why a separate backend for CLIP instead of running it in the browser

**Decision:** CLIP ViT-L/14 runs on a FastAPI server (Modal.com), not in the browser.

**Why:** CLIP ViT-L/14 is ~300 MB and takes 2-3 seconds per inference even on a fast CPU. Running it in the browser would block the UI thread and make the app unusable. The browser handles fast CNN/ViT models (sub-100ms); the backend handles the heavy CLIP analysis. The frontend falls back gracefully when the backend is offline.

---

## 4. Why CLIP/UnivFD specifically for the backend

**Decision:** Use CLIP ViT-L/14 + UnivFD linear probe, not a fine-tuned classifier.

**Why:** The key problem with deepfake detection is generalization — models trained on known generators fail on new ones. CLIP was trained by OpenAI on 400M image-text pairs to understand images semantically. UnivFD (Ojha et al. CVPR 2023) showed that a simple linear probe on top of frozen CLIP features generalizes to diffusion models (SD, DALL-E) even when trained only on GAN images. This is the only open-source approach with demonstrated generalization to unseen generators. The linear probe weights are only 4 KB — CLIP does all the heavy lifting.

---

## 5. Why Modal.com for hosting

**Decision:** Deploy the CLIP backend to Modal.com free tier.

**Why:** The backend needs ~2 GB RAM for CLIP. This rules out Render (512 MB free tier) and Railway (limited free credits). Modal.com's free tier gives 30 GB-hours/month of compute, scales to zero when idle (no cost), and has a persistent Volume for caching CLIP weights so cold starts stay reasonable (~10s vs 30s+ without caching). It's also designed for ML workloads — the deployment is a single `modal deploy` command.

---

## 6. Why the ViT-Deepfake-Exp model gets 3× weight

**Decision:** ViT-Deepfake-Exp (98.8% accuracy) gets weight 3.0 in Group A, the highest of any model.

**Why:** It has the highest validated accuracy of any available ONNX deepfake model. In an ensemble, you want to weight models proportional to their reliability. Giving it 3× means it contributes ~43% of Group A's score when all 4 models are present. The second-best model (ViT-v2 at 92.1%) gets 2×. This is intentional — you want the best model to lead, with others providing diversity and catching cases the leader misses.

---

## 7. Why two ViT models with different training sets

**Decision:** Include both ViT-Deepfake-Exp and ViT-Deepfake-v2 despite similar architectures.

**Why:** Ensemble diversity. Two models with the same architecture but different training data will disagree on edge cases in different ways. When they agree, confidence is high. When they disagree, the ensemble is appropriately uncertain. Using only the best model would miss cases where it has a blind spot that the second model catches.

---

## 8. Why UnivFD weight is 35% of the final score

**Decision:** CLIP/UnivFD gets 35% of the final verdict (Group B weight).

**Why:** CLIP is the best available signal for AI-generated content generalization, but it has limitations — it's not specifically trained for deepfake detection, and the zero-shot fallback (when UnivFD weights aren't loaded) is less reliable. 35% is high enough to meaningfully influence the verdict when CLIP is confident, but not so high that a CLIP false positive overrides strong agreement from the browser models.

---

## 9. Why UnivFD runs once per video, not per frame

**Decision:** In VideoAnalyzer, UnivFD is called once on the first frame, not on every frame.

**Why:** CLIP inference takes 1-2 seconds. A 30-second video at 0.5s intervals = 60 frames. Running CLIP on all 60 frames would take 60-120 seconds just for CLIP, making video analysis unusably slow. The key insight is that CLIP detects whether the content is AI-generated — a property of the whole video, not individual frames. Running it once on the first frame is sufficient.

---

## 10. Why UnivFD runs every 10 seconds in webcam mode

**Decision:** WebcamDetector calls UnivFD at most once per 10 seconds.

**Why:** Real-time detection requires fast frame processing. CLIP at 1-2s per call would cap the detection rate at 0.5 FPS if called every frame. The 10-second throttle means CLIP contributes to the verdict periodically without blocking the real-time visual analysis. The browser models run every frame and provide the real-time signal; CLIP provides a periodic deep check.

---

## 11. Why the strong signal override at 92%

**Decision:** If any single model scores >92%, blend it in at 40% weight on top of the group result.

**Why:** The ensemble can dilute a very confident detection. If ViT-Exp scores 0.97 (extremely confident) but the other models score 0.4 (uncertain), the group average might be 0.65 — not enough to trigger a verdict. The override ensures that when one model is near-certain, that certainty isn't washed out. The 92% threshold was chosen to only trigger on genuinely high-confidence cases, not on every slightly elevated score.

---

## 12. Why .gitignore excludes ONNX model files

**Decision:** `public/models/onnx/` is gitignored. Models are downloaded via script.

**Why:** The 4 ONNX models total ~600 MB. Git is not designed for large binary files — they bloat the repo permanently (even if deleted later, they stay in history). The download script (`scripts/download_onnx_models.ps1`) fetches them from HuggingFace on demand. MesoNet (~100 KB) is included in git because it's small enough and has no external dependency.

---

## 13. Why the Python venv is in scripts/.venv312

**Decision:** Python virtual environment lives at `scripts/.venv312`, not at the project root.

**Why:** The venv is only needed for the model conversion scripts and local backend development. Keeping it in `scripts/` makes it clear it's a tooling dependency, not a project dependency. It's gitignored via `.venv*/` pattern. The `312` suffix indicates Python 3.12 — useful if multiple Python versions are installed.

---

## 14. Why ELA forensics runs separately from the main detector

**Decision:** ELA (Error Level Analysis) runs as a separate step in ImageAnalyzer and its anomalies are merged into the result, rather than being part of `detectMultiModal`.

**Why:** ELA requires re-encoding the image as JPEG at a known quality level and comparing pixel-by-pixel — it's a canvas operation, not a model inference. It doesn't fit cleanly into the tensor-based detection pipeline. Running it separately and merging anomalies keeps the code cleaner and allows ELA to fail independently without affecting the main detection result.

---

## 15. Why the backend auto-downloads UnivFD weights

**Decision:** `backend/main.py` downloads `fc_weights.pth` from GitHub on first startup if not present.

**Why:** The UnivFD weights are only 4 KB (a single linear layer). There's no reason to require manual download. Auto-downloading on startup means the backend works out of the box with no setup steps beyond installing dependencies. The weights are cached in `backend/weights/` (gitignored) after the first download.
