# Quick Reference - Deepfake Detection System

## 🚀 Quick Import Guide

```typescript
// Utilities
import { 
  euclideanDistance, mean, calculateConfidence 
} from '@/utils/mathUtils';

import { 
  drawBoundingBox, drawLandmarks, clearCanvas 
} from '@/utils/canvasUtils';

import { 
  loadVideo, extractFrames, getWebcamStream 
} from '@/utils/videoUtils';

// OpenCV
import { 
  waitForOpenCV, canvasToMat, preprocessForML, 
  resizeImage, gaussianBlur 
} from '@/lib/opencv';

// MediaPipe
import { 
  getFaceDetector, getFaceMesh, FeatureAggregator 
} from '@/lib/mediapipe';

// TensorFlow
import { 
  getDeepfakeDetector, canvasToTensor 
} from '@/lib/tensorflow';

// Audit Logging
import { useAuditLog } from '@/hooks/useAuditLog';
```

---

## 📝 Common Patterns

### Pattern 1: Process Webcam Frame
```typescript
const processWebcamFrame = async (video: HTMLVideoElement) => {
  const faceDetector = getFaceDetector();
  const faceMesh = getFaceMesh();
  const detector = getDeepfakeDetector();
  
  const faces = await faceDetector.detect(video);
  if (!faces[0]?.detected) return null;
  
  const mesh = await faceMesh.detect(video);
  if (!mesh.detected) return null;
  
  const features = new FeatureAggregator();
  // ... extract features
  
  const result = await detector.detectFromFeatures(features.getFeatures(mesh.landmarks!));
  return result;
};
```

### Pattern 2: Process Image Upload
```typescript
const processImage = async (file: File) => {
  const { logDetection, getTimingHelper } = useAuditLog();
  const timer = getTimingHelper();
  
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  drawImageScaled(canvas, img);
  
  await waitForOpenCV();
  const mat = canvasToMat(canvas);
  const processed = preprocessForML(mat, 224);
  
  const detector = getDeepfakeDetector();
  const tensor = canvasToTensor(canvas);
  const result = await detector.detectFromImage(tensor);
  
  await logDetection({
    detection_type: 'image',
    media_type: file.type,
    file_name: file.name,
    file_size: file.size,
    detection_result: result.isDeepfake ? 'deepfake' : 'real',
    confidence_score: result.confidence,
    processing_time_ms: timer.getElapsedMs(),
  });
  
  return result;
};
```

### Pattern 3: Process Video
```typescript
const processVideo = async (file: File) => {
  const video = await loadVideo(file);
  const frames = await extractFrames(video, 30);
  
  const results = [];
  for (const frame of frames) {
    const result = await processWebcamFrame(frame);
    if (result) results.push(result);
  }
  
  const detector = getDeepfakeDetector();
  return detector.combineResults(results);
};
```

---

## 🎯 Key Functions

### OpenCV
| Function | Purpose |
|----------|---------|
| `waitForOpenCV()` | Wait for OpenCV to load |
| `canvasToMat(canvas)` | Convert canvas to OpenCV Mat |
| `preprocessForML(mat, size)` | Full preprocessing pipeline |
| `gaussianBlur(mat)` | Reduce noise |
| `resizeImage(mat, w, h)` | Resize image |

### MediaPipe
| Function | Purpose |
|----------|---------|
| `getFaceDetector()` | Get face detector instance |
| `getFaceMesh()` | Get face mesh instance |
| `detector.detect(input)` | Detect faces/landmarks |
| `calculateEyeAspectRatio()` | Calculate blink metric |

### TensorFlow
| Function | Purpose |
|----------|---------|
| `getDeepfakeDetector()` | Get detector instance |
| `detectFromFeatures()` | Classify from features |
| `detectFromImage()` | Classify from tensor |
| `canvasToTensor()` | Convert canvas to tensor |

### Audit Logging
| Function | Purpose |
|----------|---------|
| `useAuditLog()` | Get logging hook |
| `logDetection()` | Log detection to DB |
| `getTimingHelper()` | Track processing time |

---

## 📊 Detection Results Structure

```typescript
interface DetectionResult {
  isDeepfake: boolean;      // True if deepfake detected
  confidence: number;        // 0.0 - 1.0
  scores: {
    faceMesh?: number;
    texture?: number;
    lighting?: number;
    temporal?: number;
    features?: number;
  };
  anomalies: string[];      // List of detected issues
}
```

---

## 🎨 Visualization

```typescript
// Draw bounding box
drawBoundingBox(ctx, { x: 100, y: 100, width: 200, height: 200 }, '#00ff00');

// Draw landmarks
drawLandmarks(ctx, landmarks, '#ff0000', 2);

// Draw confidence overlay
drawConfidenceOverlay(ctx, 0.95, false, 10, 30);
```

---

## 🔧 Component Structure Template

```typescript
const MyDetectionComponent = () => {
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { logDetection } = useAuditLog();
  
  const handleDetection = async (input: File | HTMLVideoElement) => {
    setLoading(true);
    try {
      // 1. Initialize
      const faceDetector = getFaceDetector();
      const faceMesh = getFaceMesh();
      const detector = getDeepfakeDetector();
      
      // 2. Detect
      const faces = await faceDetector.detect(input);
      const mesh = await faceMesh.detect(input);
      
      // 3. Extract features
      // ... feature extraction ...
      
      // 4. Classify
      const result = await detector.detectFromFeatures(features);
      
      // 5. Log
      await logDetection({ /* ... */ });
      
      // 6. Update UI
      setResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  return (/* JSX */);
};
```

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| OpenCV not loading | Check `<script>` tag in `index.html` |
| MediaPipe errors | Call `waitForInitialization()` |
| Memory leaks | Call `.delete()` on Mats, use `tf.tidy()` |
| Slow webcam | Throttle processing to 100-200ms |
| Low accuracy | Combine multiple detection methods |

---

## 📚 Documentation Files

- `IMPLEMENTATION-COMPLETE.md` - Full status report
- `DETECTION-SYSTEM-GUIDE.md` - Architecture & usage
- `AUDIT-LOGS-SETUP.md` - Database setup
- `AUDIT-LOGS-QUICKSTART.md` - Quick integration
- `AUDIT-LOGS-IMPLEMENTATION.md` - Audit system details

---

## ✅ Checklist for New Components

- [ ] Import required modules
- [ ] Initialize detectors (use singletons)
- [ ] Set up state management
- [ ] Handle file uploads / webcam
- [ ] Process with pipeline
- [ ] Display results
- [ ] Add error handling
- [ ] Integrate audit logging
- [ ] Add loading states
- [ ] Test memory cleanup
- [ ] Optimize performance

---

## 🎯 Next Steps

1. Create `WebcamDetector.tsx`
2. Create `ImageAnalyzer.tsx`
3. Create `VideoAnalyzer.tsx`
4. Create `ResultsDisplay.tsx`
5. Create `Detection.tsx` page
6. Test and optimize
7. Deploy! 🚀
