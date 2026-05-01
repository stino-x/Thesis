# Developer Documentation - Deepfake Detection System

**Author:** Iheagwara Augustine 
**Date:** April 26, 2026  
**Version:** 1.0

---

## Overview

This document explains the technical implementation of the deepfake detection system. It's intended for developers who want to understand how the system works, modify it, or build upon it.

The system is a React web application that runs machine learning models in the browser using TensorFlow.js and ONNX Runtime Web. The core idea is to combine multiple detection approaches - some models catch face swaps, others spot AI-generated content, and additional forensic signals add extra validation.

---

## Architecture

### High-Level Design

```
User Interface (React)
         ↓
Detection Orchestrator
         ↓
    ┌────┴────┬─────────┬──────────┐
    ↓         ↓         ↓          ↓
Browser    CLIP     Forensic   Multi-modal
Models    Backend   Analysis    Signals
    ↓         ↓         ↓          ↓
         Ensemble Combiner
                ↓
            Results
```

**Browser Models:** 5 ML models running via TF.js and ONNX Runtime  
**CLIP Backend:** Optional server-side detector on Modal.com  
**Forensic Analysis:** ELA, metadata checks  
**Multi-modal Signals:** PPG, face mesh, lip-sync, voice analysis  
**Ensemble Combiner:** Grouped voting system that combines everything

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS + shadcn/ui for styling
- React Router for navigation

**ML/AI:**
- TensorFlow.js for MesoNet model
- ONNX Runtime Web for ViT and SwinV2 models
- MediaPipe Tasks Vision for face detection and mesh
- OpenCV.js for image preprocessing

**Backend:**
- FastAPI (Python) for local development
- Modal.com for serverless deployment
- PyTorch + CLIP for the backend model

**Data & Auth:**
- Supabase for authentication and database
- PostgreSQL with row-level security


---

## Project Structure

```
src/
├── components/
│   ├── detection/
│   │   ├── ImageAnalyzer.tsx      # Image upload and analysis
│   │   ├── VideoAnalyzer.tsx      # Video frame-by-frame analysis
│   │   └── WebcamDetector.tsx     # Real-time webcam detection
│   └── ui/                        # Reusable UI components (shadcn)
├── lib/
│   ├── onnx/
│   │   ├── onnxDetector.ts        # ONNX model registry and inference
│   │   └── faceLocalizer.ts       # Face cropping for ViT models
│   ├── tensorflow/
│   │   ├── detector.ts            # Main ensemble logic
│   │   └── enhancedDetector.ts    # Research features integration
│   ├── api/
│   │   └── univfdClient.ts        # CLIP backend HTTP client
│   ├── mediapipe/
│   │   ├── faceDetector.ts        # Face detection
│   │   ├── faceMesh.ts            # 468-point face mesh
│   │   └── landmarkFeatures.ts    # Blink rate, symmetry, etc.
│   ├── forensics/
│   │   ├── elaAnalyzer.ts         # Error Level Analysis
│   │   └── metadataAnalyzer.ts    # EXIF and file metadata
│   ├── physiological/
│   │   └── ppgAnalyzer.ts         # Heartbeat detection from skin
│   ├── audio/
│   │   ├── lipSyncAnalyzer.ts     # Audio-visual synchronization
│   │   └── voiceAnalyzer.ts       # Voice spectral analysis
│   ├── calibration/
│   │   └── confidenceCalibrator.ts # Platt scaling
│   ├── adversarial/
│   │   └── adversarialDetector.ts  # FFT-based attack detection
│   └── localization/
│       └── partialDeepfakeDetector.ts # Region-based analysis
├── contexts/
│   ├── AuthContext.tsx            # Authentication state
│   └── SettingsContext.tsx        # User preferences
├── hooks/
│   ├── useAuth.ts                 # Auth hook
│   ├── useSettings.ts             # Settings hook
│   └── useAuditLog.ts             # Logging hook
└── pages/
    ├── Detection.tsx              # Main detection page
    ├── AuditLogsPage.tsx          # Detection history
    └── Profile.tsx                # User profile

backend/
├── main.py                        # FastAPI server (local dev)
└── modal_app.py                   # Modal.com deployment

public/models/
├── mesonet/                       # TF.js weights (in repo)
└── onnx/                          # ONNX models (downloaded)
```


---

## Core Components

### 1. ONNX Detector (`src/lib/onnx/onnxDetector.ts`)

This is where I define all the ONNX models and handle inference.

**Model Registry:**
```typescript
const MODELS = {
  vitDeepfakeExp: {
    local: '/models/onnx/vit_deepfake_exp.onnx',
    remote: 'https://huggingface.co/.../model.onnx',
    inputSize: 224,
    norm: 'imagenet',
    fakeIndex: 0,  // which output index = fake
    weight: 3.0,   // ensemble weight
  },
  // ... other models
}
```

**Key Functions:**
- `initOnnxDetector()` - Loads all models in parallel
- `detectWithOnnx(imageData)` - Runs inference on all loaded models
- `preprocessImage(imageData, size, norm)` - Prepares input tensor

**How it works:**
1. Models are loaded from local files first, fallback to HuggingFace CDN
2. ONNX Runtime uses WebAssembly with multi-threading (requires COOP/COEP headers)
3. Models are cached in IndexedDB after first load
4. Inference runs all models in parallel using Promise.all()

### 2. TensorFlow Detector (`src/lib/tensorflow/detector.ts`)

The main ensemble logic lives here.

**DeepfakeDetector Class:**
```typescript
class DeepfakeDetector {
  async detectFromImage(imageData, faceBbox) {
    // 1. Run ONNX models
    const onnx = await detectWithOnnx(imageData);
    
    // 2. Group models by specialty
    const groupA = []; // face manipulation
    const groupB = []; // AI generation
    
    // 3. Weighted voting within groups
    const scoreA = weightedAverage(groupA);
    const scoreB = weightedAverage(groupB);
    
    // 4. Combine groups
    return combineScores(scoreA, scoreB);
  }
}
```

**Ensemble Strategy:**
I use grouped voting instead of flat averaging. Here's why:

If you have 4 face-swap models and 1 AI-art model, a flat average would let the face-swap models dominate even on AI-generated images. Grouped voting gives each specialty a fair vote.

**Groups:**
- Group A (55% weight): Face manipulation models
- Group B (35% weight): AI generation models + CLIP
- Group C (10% weight): Forensic signals

**Strong Signal Override:**
If any single model scores >92%, it gets blended in at 40% weight. This prevents the ensemble from diluting a very confident detection.

### 3. Image Analyzer (`src/components/detection/ImageAnalyzer.tsx`)

Orchestrates the full image analysis pipeline.

**Flow:**
```typescript
async function analyzeImage(file) {
  // 1. Load and preprocess
  const imageData = await loadImage(file);
  
  // 2. Detect face
  const face = await detectFace(imageData);
  if (!face) throw new Error('No face detected');
  
  // 3. Get face mesh (468 landmarks)
  const mesh = await getFaceMesh(imageData, face);
  
  // 4. Run detection (parallel)
  const [visual, univfd] = await Promise.all([
    detector.detectMultiModal(imageData, mesh, ...),
    univfdClient.detect(file)
  ]);
  
  // 5. Run forensics
  const ela = await analyzeELA(imageData);
  const metadata = await analyzeMetadata(file);
  
  // 6. Combine and display
  const final = combineResults(visual, univfd, ela, metadata);
  setResults(final);
}
```

**Key Points:**
- Face detection is required - we can't analyze images without faces
- CLIP backend runs in parallel with visual analysis (not sequential)
- ELA and metadata are separate passes
- All errors are caught and handled gracefully


---

## Detection Methods

### Visual Models

**ViT Deepfake Exp (98.8% accuracy):**
Vision Transformer trained on face-swap deepfakes. My best single model. Gets 3x weight in the ensemble because of its high accuracy.

**ViT Deepfake v2 (92.1% accuracy):**
Another ViT model trained on different data. Adds diversity - sometimes catches things the first ViT misses. Gets 2x weight.

**SwinV2 AI Detector (98.1% accuracy):**
Swin Transformer trained on real photos vs AI-generated images (Stable Diffusion, DALL-E, Midjourney, Adobe Firefly). This is my go-to for AI art detection. Gets 2x weight.

**DeepfakeDetector & MesoNet:**
Additional face manipulation detectors. MesoNet is tiny (0.1 MB) and fast, good for catching classic deepfakes. Gets 1x weight as baseline.

### CLIP Backend

Uses OpenAI's CLIP model with a linear probe (UnivFD approach). The key insight is that CLIP's feature space naturally separates real from synthetic images, even for generators it wasn't trained on.

**Why it works:**
CLIP was trained on image-text pairs from the internet. Real photos and AI-generated images occupy different regions of its feature space. A simple linear classifier on top of CLIP features can detect this.

**Deployment:**
Hosted on Modal.com serverless. Cold start takes ~10 seconds (downloading CLIP weights), then it's fast (~1-2 seconds per image).

### Forensic Signals

**ELA (Error Level Analysis):**
Looks for inconsistent JPEG compression. When you edit an image and re-save it, the edited regions have different compression levels than the original. I convert the image to JPEG at quality 95, then compare it to the original to find these differences.

**Metadata Analysis:**
Checks EXIF data for suspicious patterns:
- AI-typical resolutions (512x512, 1024x1024)
- Missing camera information
- Inconsistent timestamps
- Software tags indicating AI tools

**PPG (Photoplethysmography):**
Based on Intel's FakeCatcher paper. Real skin shows subtle color changes from blood flow (heartbeat). I extract the green channel from face regions, apply bandpass filtering (0.7-4 Hz for heart rate), and look for periodic signals. Deepfakes usually don't have this.

**Face Mesh Analysis:**
Using MediaPipe's 468-point face mesh, I check:
- Blink rate (real humans blink 15-20 times/minute)
- Eye aspect ratio consistency
- Face symmetry
- Landmark jitter (deepfakes often have unstable landmarks)

**Lip-Sync (videos only):**
Extracts audio and checks if mouth movements match speech. I use phoneme onset detection - certain sounds (like 'p', 'b', 'm') require closed lips. If the mouth is open during these sounds, it's suspicious.

**Voice Analysis (videos only):**
Looks at spectral features of the audio. Synthetic voices often have artifacts in high frequencies or unusual formant patterns.


---

## Research Features

### Confidence Calibration

Raw neural network outputs aren't true probabilities. A model might output 0.7, but that doesn't mean 70% probability - it's just a relative score.

**Platt Scaling:**
I use Platt scaling to calibrate scores into proper probabilities:

```typescript
function plattScaling(score: number): number {
  // Logistic function with learned parameters
  const A = -2.5;  // tuned on validation set
  const B = 0.5;
  return 1 / (1 + Math.exp(A * score + B));
}
```

The parameters A and B are tuned on a validation set where I know the true labels. This maps raw scores to calibrated probabilities.

**Ensemble Calibration:**
For multiple models, I:
1. Calibrate each model's score individually
2. Weight by model reliability (how much models agree)
3. Compute confidence interval using bootstrap

**Why it matters:**
For forensic or legal use, you need to say "85% probability" with statistical backing. Calibration makes this possible.

### Adversarial Detection

Adversarial attacks add small, carefully crafted noise to images that's invisible to humans but fools ML models.

**Detection Method:**
I use FFT (Fast Fourier Transform) to analyze frequency content:

```typescript
function detectAdversarial(imageData): boolean {
  // 1. Convert to grayscale
  const gray = toGrayscale(imageData);
  
  // 2. Apply FFT
  const freq = fft2d(gray);
  
  // 3. Compute high-frequency energy
  const highFreqEnergy = computeHighFreqEnergy(freq);
  
  // 4. Check if abnormally high
  return highFreqEnergy > THRESHOLD;
}
```

Adversarial perturbations concentrate in high frequencies. If I see unusually high energy there, it's suspicious.

**Additional Checks:**
- Model disagreement (adversarial examples cause unusual score patterns)
- Multi-modal consistency (attacks usually only fool visual models)
- Statistical anomalies in pixel distributions

### Partial Deepfake Detection

Not all deepfakes manipulate the entire face. Sometimes just the mouth is swapped, or only the eyes.

**Region-Based Analysis:**
I divide the face into regions using the face mesh:
- Eyes (left and right)
- Nose
- Mouth
- Face boundary

For each region, I:
1. Extract a crop around that region
2. Run detection on just that crop
3. Compare scores across regions

If one region scores much higher than others, it's likely a partial deepfake.

**Heatmap Generation:**
I create a heatmap overlay showing which regions are suspicious:
- Red: High manipulation probability
- Yellow: Medium suspicion
- Green: Likely authentic

This is useful for forensic analysis - you can see exactly which part was manipulated.


---

## Ensemble Logic

This is the core of how I combine everything.

### Grouped Voting

```typescript
function combineMultiModalResults(
  visualScore: number,
  univfdScore: number,
  forensicScore: number
): number {
  const parts: [number, number][] = [];
  
  if (visualScore !== null) {
    parts.push([visualScore, 0.50]);  // 50% weight
  }
  if (univfdScore !== null) {
    parts.push([univfdScore, 0.35]);  // 35% weight
  }
  if (forensicScore !== null) {
    parts.push([forensicScore, 0.15]); // 15% weight
  }
  
  // Normalize weights if some are missing
  const totalWeight = parts.reduce((sum, [_, w]) => sum + w, 0);
  
  // Weighted average
  const score = parts.reduce((sum, [s, w]) => {
    return sum + s * (w / totalWeight);
  }, 0);
  
  return score;
}
```

### Within-Group Voting

For Group A (face manipulation models):

```typescript
const groupA: [number, number][] = [];
if (onnx.vitDeepfakeExp) {
  groupA.push([onnx.vitDeepfakeExp.score, 3.0]);
}
if (onnx.vitDeepfakeV2) {
  groupA.push([onnx.vitDeepfakeV2.score, 2.0]);
}
if (onnx.deepfakeDetector) {
  groupA.push([onnx.deepfakeDetector.score, 1.5]);
}
if (mesonet) {
  groupA.push([mesonet.score, 1.0]);
}

const scoreA = weightedAverage(groupA);
```

### Strong Signal Override

```typescript
function applyStrongSignalBoost(
  ensembleScore: number,
  allScores: number[]
): number {
  const maxScore = Math.max(...allScores);
  
  if (maxScore > 0.92) {
    // Blend in the strong signal at 40% weight
    return 0.6 * ensembleScore + 0.4 * maxScore;
  }
  
  return ensembleScore;
}
```

This prevents the ensemble from diluting a very confident detection. If one model is 95% sure it's fake, I don't want the ensemble to average that down to 70%.

---

## Performance Optimizations

### Model Loading

**Parallel Loading:**
All models load simultaneously using Promise.all(). This is much faster than loading sequentially.

**Caching:**
- ONNX models cached in IndexedDB
- TF.js models cached by the framework
- Backend availability cached in memory

**Lazy Loading:**
Models only load when first needed. If you never use webcam mode, those models don't load.

### Inference

**Batch Processing (videos):**
Instead of processing frames one-by-one, I batch them:

```typescript
const frames = extractFrames(video, interval);
const batches = chunk(frames, BATCH_SIZE);

for (const batch of batches) {
  const results = await Promise.all(
    batch.map(frame => detector.detect(frame))
  );
  // Process results
}
```

This is 4x faster than sequential processing.

**WebAssembly Threading:**
ONNX Runtime uses SharedArrayBuffer for multi-threading. This requires specific headers in vite.config.ts:

```typescript
headers: {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}
```

Without these, ONNX falls back to single-threaded mode (much slower).

### Memory Management

**Image Downsampling:**
Large images are downsampled before processing:

```typescript
if (width > MAX_SIZE || height > MAX_SIZE) {
  const scale = MAX_SIZE / Math.max(width, height);
  imageData = resizeImage(imageData, scale);
}
```

**Tensor Cleanup:**
TensorFlow.js tensors must be manually disposed:

```typescript
tf.tidy(() => {
  const tensor = tf.browser.fromPixels(imageData);
  const result = model.predict(tensor);
  return result.dataSync();
});
```

The `tidy()` wrapper automatically cleans up intermediate tensors.


---

## Backend Implementation

### FastAPI Server (local dev)

```python
from fastapi import FastAPI, File, UploadFile
import torch
import clip
from PIL import Image

app = FastAPI()

# Load CLIP model
device = "cuda" if torch.cuda.is_available() else "cpu"
model, preprocess = clip.load("ViT-L/14", device=device)

@app.post("/detect")
async def detect(file: UploadFile):
    # Load image
    image = Image.open(file.file)
    
    # Preprocess
    image_input = preprocess(image).unsqueeze(0).to(device)
    
    # Get CLIP features
    with torch.no_grad():
        features = model.encode_image(image_input)
    
    # Linear probe (UnivFD)
    score = univfd_probe(features)
    
    return {
        "confidence": float(score),
        "isDeepfake": score > 0.5
    }
```

### Modal Deployment

Modal.com handles serverless deployment. The key is caching the CLIP weights in a Modal Volume so they don't download on every cold start:

```python
import modal

stub = modal.Stub("deepfake-detector")

# Create volume for model weights
volume = modal.Volume.persisted("clip-weights")

@stub.function(
    image=modal.Image.debian_slim()
        .pip_install("torch", "clip", "pillow"),
    volumes={"/cache": volume},
    timeout=300,
)
def detect_image(image_bytes):
    # Load CLIP from cache
    model = load_clip_from_cache("/cache")
    
    # Run detection
    return detect(image_bytes, model)
```

---

## Database Schema

### Audit Logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  detection_type TEXT,  -- 'image', 'video', 'webcam'
  media_type TEXT,      -- 'image/jpeg', 'video/mp4', etc.
  file_name TEXT,
  file_size BIGINT,
  detection_result TEXT, -- 'REAL' or 'DEEPFAKE'
  confidence_score FLOAT,
  processing_time_ms INT,
  metadata JSONB,       -- full detection results
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own logs"
  ON audit_logs
  FOR ALL
  USING (auth.uid() = user_id);
```

The metadata JSONB column stores the complete detection results including per-model scores, anomalies, and settings used.

---

## Testing

### Unit Tests

I have 72 unit tests covering the research features:

```typescript
describe('Confidence Calibration', () => {
  it('should calibrate raw scores to probabilities', () => {
    const scores = { model1: 0.8, model2: 0.6, model3: 0.7 };
    const result = calibrateEnsemble(scores);
    
    expect(result.ensembleProbability).toBeCloseTo(0.7, 1);
    expect(result.reliability).toBeGreaterThan(0.5);
  });
  
  it('should compute confidence intervals', () => {
    const [lower, upper] = getConfidenceInterval(0.7, 0.8);
    
    expect(lower).toBeLessThan(0.7);
    expect(upper).toBeGreaterThan(0.7);
    expect(upper - lower).toBeLessThan(0.2);
  });
});
```

### Integration Testing

For integration testing, I manually test with known deepfakes and real images:

1. Collect test set (real images, face swaps, AI-generated)
2. Run detection on each
3. Verify results match expectations
4. Check that ensemble improves over individual models

---

## Deployment

### Frontend

```bash
# Build for production
npm run build

# Output goes to dist/
# Deploy dist/ to any static host (Vercel, Netlify, etc.)
```

### Backend

```bash
# Deploy to Modal
modal deploy backend/modal_app.py

# Get the public URL
# Update VITE_BACKEND_URL in .env
```

### Environment Variables

```env
# Supabase (required for auth)
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Backend (optional)
VITE_BACKEND_URL=https://your-modal-url

# Site URL (for OAuth redirects)
VITE_SITE_URL=https://your-domain.com
```

---

## Conclusion

This system combines multiple detection approaches to achieve better accuracy than any single method. The key insights are:

1. **Ensemble diversity:** Different models catch different types of fakes
2. **Grouped voting:** Prevents one specialty from dominating
3. **Multi-modal signals:** Adds validation beyond just visual models
4. **Research features:** Makes it suitable for forensic use

The implementation prioritizes running everything in the browser for privacy and accessibility, with an optional backend for improved generalization.

---

**Author:** Augustine Iheagwara  
**Institution:** ELTE Faculty of Informatics  
**Contact:** austindev214@gmail.com  
**Repository:** https://github.com/stino-x/Thesis
