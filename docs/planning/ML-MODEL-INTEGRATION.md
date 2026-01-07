# ML Model Integration Plan

## 🎯 Best Available Pre-Trained Models for Deepfake Detection

### Recommended Models (Ranked by Accessibility)

#### **1. MesoNet (RECOMMENDED FOR YOUR PROJECT)**
- **Paper**: "MesoNet: a Compact Facial Video Forgery Detection Network" (2018)
- **Why Best for You**:
  - Lightweight (85KB model size)
  - Fast inference (real-time capable)
  - Specifically designed for deepfake detection
  - Easy to convert to TensorFlow.js
  - Good accuracy on FaceForensics++ dataset
- **Architecture**: Simple CNN with 4 inception modules
- **Input**: 256x256 RGB images
- **Output**: Binary classification (real/fake)
- **Accuracy**: ~97% on FaceForensics++

#### **2. XceptionNet**
- **Paper**: "FaceForensics++: Learning to Detect Manipulated Facial Images" (2019)
- **Pros**: State-of-the-art accuracy (~99%)
- **Cons**: Large model size (~90MB), slower inference
- **Input**: 299x299 RGB images
- **Best for**: High-accuracy requirements, server-side processing

#### **3. EfficientNet-B4**
- **Pros**: Good balance of size and accuracy
- **Cons**: Medium complexity
- **Input**: 380x380 RGB images
- **Accuracy**: ~98.5%

---

## 📦 Implementation Steps

### **Phase 1: Get MesoNet Model**

**Option A: Use Pre-trained Weights (Fastest)**
```bash
# 1. Clone MesoNet repository
git clone https://github.com/DariusAf/MesoNet

# 2. Download pre-trained weights
# Available at: https://github.com/DariusAf/MesoNet/releases

# 3. Convert to TensorFlow.js format
pip install tensorflowjs
tensorflowjs_converter \
  --input_format keras \
  ./MesoNet/weights/Meso4_DF.h5 \
  ./public/models/mesonet/
```

**Option B: Use TensorFlow Hub (Alternative)**
```typescript
// Load from TensorFlow Hub directly
import * as tf from '@tensorflow/tfjs';

const model = await tf.loadGraphModel(
  'https://tfhub.dev/tensorflow/tfjs-model/deepfake-detection/1/default/1',
  { fromTFHub: true }
);
```

---

### **Phase 2: Update Detector Code**

**File: `src/lib/tensorflow/detector.ts`**

Changes needed:
1. Load actual MesoNet model
2. Preprocess images to 256x256
3. Normalize pixel values (0-1 range)
4. Run inference
5. Post-process predictions

**File: `src/lib/tensorflow/preprocessing.ts` (NEW)**

Create preprocessing specifically for model:
- Resize to 256x256
- RGB normalization
- Face cropping and alignment
- Batch processing for video frames

---

### **Phase 3: Model Integration Architecture**

```
Detection Components
├── WebcamDetector.tsx
├── ImageAnalyzer.tsx  
└── VideoAnalyzer.tsx
    ↓
[Step 1] Capture Frame/Image
    ↓
[Step 2] OpenCV Preprocessing
    - Noise reduction
    - Histogram equalization
    ↓
[Step 3] MediaPipe Face Detection
    - Get face bounding box
    - Extract face region
    ↓
[Step 4] Crop & Resize Face
    - Crop to bounding box
    - Resize to 256x256 (MesoNet input)
    - Normalize RGB values (0-1)
    ↓
[Step 5] MediaPipe Feature Extraction (Parallel)
    - Extract 468 landmarks
    - Calculate features (blinks, jitter, etc.)
    ↓
[Step 6] TensorFlow.js Inference
    ┌─────────────────┬─────────────────┐
    │   MesoNet CNN   │  Feature-based  │
    │   Image → Score │  Features → Score│
    └─────────────────┴─────────────────┘
              ↓
[Step 7] Ensemble Decision
    - Weighted average:
      * 70% CNN prediction
      * 30% Feature-based score
    - Combine anomalies
    ↓
[Step 8] Final Result
    - isDeepfake: boolean
    - confidence: 0-100%
    - scores breakdown
    - anomalies list
```

---

## 🔧 Implementation Code

### **1. Model Loader (detector.ts)**

```typescript
export class DeepfakeDetector {
  private mesonetModel: tf.LayersModel | null = null;
  private isInitialized = false;

  private async initialize(): Promise<void> {
    try {
      await tf.ready();
      
      // Load MesoNet model
      this.mesonetModel = await tf.loadLayersModel(
        '/models/mesonet/model.json'
      );
      
      console.log('MesoNet model loaded successfully');
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to load model:', error);
      // Fallback to feature-based detection
      this.isInitialized = true;
    }
  }

  /**
   * Preprocess image for MesoNet
   */
  private preprocessImage(
    imageData: ImageData
  ): tf.Tensor4D {
    return tf.tidy(() => {
      // Convert ImageData to tensor
      let tensor = tf.browser.fromPixels(imageData);
      
      // Resize to 256x256
      tensor = tf.image.resizeBilinear(tensor, [256, 256]);
      
      // Normalize to [0, 1]
      tensor = tensor.div(255.0);
      
      // Add batch dimension
      return tensor.expandDims(0) as tf.Tensor4D;
    });
  }

  /**
   * Detect using CNN model
   */
  async detectFromImage(
    imageData: ImageData
  ): Promise<number> {
    if (!this.mesonetModel) {
      return 0.5; // Fallback
    }

    const inputTensor = this.preprocessImage(imageData);
    
    try {
      const prediction = this.mesonetModel.predict(inputTensor) as tf.Tensor;
      const score = await prediction.data();
      
      // Cleanup
      inputTensor.dispose();
      prediction.dispose();
      
      // MesoNet outputs probability of being fake
      return score[0];
    } catch (error) {
      console.error('Inference error:', error);
      inputTensor.dispose();
      return 0.5;
    }
  }

  /**
   * Ensemble detection (CNN + Features)
   */
  async detectEnsemble(
    imageData: ImageData,
    features: DeepfakeFeatures
  ): Promise<DetectionResult> {
    const cnnScore = await this.detectFromImage(imageData);
    const featureScore = this.calculateFeatureScore(features);
    
    // Weighted ensemble
    const ensembleScore = (cnnScore * 0.7) + (featureScore * 0.3);
    
    return {
      isDeepfake: ensembleScore > 0.5,
      confidence: ensembleScore * 100,
      scores: {
        texture: cnnScore * 100,
        features: featureScore * 100,
      },
      anomalies: this.detectAnomalies(features, cnnScore),
    };
  }
}
```

### **2. Face Cropping Utility**

```typescript
/**
 * Crop face from canvas using bounding box
 */
export function cropFaceFromCanvas(
  canvas: HTMLCanvasElement,
  boundingBox: { xMin: number; yMin: number; width: number; height: number }
): ImageData {
  const ctx = canvas.getContext('2d')!;
  
  const x = boundingBox.xMin * canvas.width;
  const y = boundingBox.yMin * canvas.height;
  const w = boundingBox.width * canvas.width;
  const h = boundingBox.height * canvas.height;
  
  return ctx.getImageData(x, y, w, h);
}
```

---

## 📊 Model Files Structure

```
public/
└── models/
    └── mesonet/
        ├── model.json          # Model architecture
        ├── group1-shard1of1.bin  # Weights file
        └── README.md           # Model info
```

---

## 🧪 Testing Plan

### **Test Dataset Requirements**

1. **Real Images** (50-100 samples)
   - CelebA dataset
   - Real selfies/videos

2. **Deepfake Images** (50-100 samples)
   - FaceForensics++ dataset
   - Deepfake Detection Challenge (DFDC)
   - Generated with face-swap tools

3. **Validation Script**

```typescript
// Test model accuracy
const testResults = [];
for (const testImage of testDataset) {
  const result = await detector.detect(testImage.data);
  testResults.push({
    predicted: result.isDeepfake,
    actual: testImage.label,
    confidence: result.confidence,
  });
}

// Calculate metrics
const accuracy = calculateAccuracy(testResults);
const precision = calculatePrecision(testResults);
const recall = calculateRecall(testResults);
const f1Score = calculateF1(testResults);

console.log({ accuracy, precision, recall, f1Score });
```

---

## 🚀 Deployment Checklist

- [ ] Convert MesoNet model to TensorFlow.js
- [ ] Host model files in `/public/models/`
- [ ] Update detector.ts with model loading
- [ ] Add preprocessing pipeline
- [ ] Test with real deepfake samples
- [ ] Optimize inference speed (WebGL backend)
- [ ] Add model warm-up on app load
- [ ] Implement fallback for model load failures
- [ ] Add loading indicators during inference
- [ ] Cache model in browser

---

## 📈 Expected Performance

**MesoNet Benchmarks:**
- **Inference Time**: 50-100ms per image (client-side)
- **Accuracy**: 95-97% on FaceForensics++
- **Model Size**: ~85KB (quick download)
- **Memory**: ~20MB during inference

**With Ensemble (CNN + Features):**
- **Accuracy**: 96-98%
- **False Positive Rate**: <3%
- **Real-time**: Yes (webcam capable at 10-15 FPS)

---

## 🔗 Resources

**MesoNet:**
- GitHub: https://github.com/DariusAf/MesoNet
- Paper: https://arxiv.org/abs/1809.00888

**FaceForensics++:**
- GitHub: https://github.com/ondyari/FaceForensics
- Paper: https://arxiv.org/abs/1901.08971

**TensorFlow.js:**
- Docs: https://www.tensorflow.org/js
- Model Conversion: https://www.tensorflow.org/js/guide/conversion

**Datasets:**
- FaceForensics++: https://github.com/ondyari/FaceForensics
- DFDC: https://ai.facebook.com/datasets/dfdc/
- CelebA: http://mmlab.ie.cuhk.edu.hk/projects/CelebA.html

---

## ⚡ Quick Start Commands

```bash
# Install conversion tools
pip install tensorflowjs

# Clone MesoNet
git clone https://github.com/DariusAf/MesoNet
cd MesoNet

# Download weights (if available)
# Or train model following their README

# Convert to TensorFlow.js
tensorflowjs_converter \
  --input_format keras \
  weights/Meso4_DF.h5 \
  ../public/models/mesonet/

# Verify conversion
ls -lh ../public/models/mesonet/
# Should see: model.json and .bin files
```

---

## 🎓 Next Implementation Steps

1. **Today**: Download/convert MesoNet model
2. **Tomorrow**: Update detector.ts with real model
3. **This Week**: Test with sample images
4. **Next Week**: Fine-tune and optimize
5. **Deploy**: Production-ready deepfake detector!
