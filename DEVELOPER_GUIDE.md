# Deepfake Detection System - Developer Guide

## Architecture Overview

The application is structured into four main modular components, each handling a specific aspect of the deepfake detection pipeline:

### 1. VideoInput Component
**Location**: `src/components/VideoInput/`

**Purpose**: Handles video source input from webcam or uploaded files.

**Key Features**:
- Webcam streaming with MediaStream API
- Video file upload support
- Automatic stream cleanup on component unmount
- Error handling for device access

**Integration Points**:
- Emits `onVideoReady(video, source)` when a video source is available
- Emits `onError(message)` for error handling

### 2. FaceDetection Component
**Location**: `src/components/FaceDetection/`

**Purpose**: Real-time face detection using MediaPipe Face Detection.

**Key Features**:
- MediaPipe Face Detection integration
- Real-time bounding box visualization
- Facial landmark detection
- Performance statistics tracking

**Model Configuration**:
- Uses BlazeFace Short Range model
- Runs in VIDEO mode for continuous detection
- Minimum confidence threshold: 0.5
- GPU acceleration via WebGL

**TODO for Production**:
```typescript
// Download and host the model locally
const MODEL_PATH = '/models/face_detector/blaze_face_short_range.tflite';
```

**Integration Points**:
- Receives `videoElement` prop
- Emits `onFaceDetected(result)` with bounding box and landmarks
- Emits `onError(message)` for errors

### 3. MLInference Component
**Location**: `src/components/MLInference/`

**Purpose**: TensorFlow.js inference pipeline for deepfake detection.

**Key Features**:
- TensorFlow.js integration with WebGL backend
- Frame preprocessing (cropping, resizing, normalization)
- Inference scheduling (500ms intervals)
- Performance monitoring
- Tensor memory management

**Current State**: 
The component includes a **complete inference pipeline** with mock predictions. It demonstrates the full workflow but requires a trained model to produce real results.

**Model Integration Steps**:

1. **Train Your Model**:
   ```python
   # Example: Train a CNN-based deepfake detector
   # Recommended architectures: EfficientNet, ResNet, MobileNet
   model = create_deepfake_detector()
   model.fit(train_data, validation_data, epochs=50)
   model.save('saved_model/')
   ```

2. **Convert to TensorFlow.js**:
   ```bash
   pip install tensorflowjs
   
   tensorflowjs_converter \
     --input_format=tf_saved_model \
     --output_format=tfjs_graph_model \
     ./saved_model \
     ./web_model
   ```

3. **Host Model Files**:
   ```
   public/
   └── models/
       └── deepfake-detector/
           ├── model.json
           ├── group1-shard1of4.bin
           ├── group1-shard2of4.bin
           ├── group1-shard3of4.bin
           └── group1-shard4of4.bin
   ```

4. **Update Configuration**:
   ```typescript
   // In src/components/MLInference/MLInference.tsx
   const MODEL_URL = '/models/deepfake-detector/model.json';
   ```

5. **Uncomment Model Loading**:
   ```typescript
   // In initializeModel()
   if (MODEL_URL) {
     const model = await tf.loadLayersModel(MODEL_URL);
     modelRef.current = model;
     setIsModelLoaded(true);
     setModelInfo(`Model loaded: ${model.inputs[0].shape?.join('x') || 'unknown'} input shape`);
   }
   ```

6. **Uncomment Inference Code**:
   ```typescript
   // In runInference()
   if (modelRef.current) {
     const prediction = modelRef.current.predict(tensor) as tf.Tensor;
     const predictionData = await prediction.data();
     const confidence = predictionData[0];
     const isDeepfake = confidence > 0.5;
     prediction.dispose();
   }
   ```

**Preprocessing Pipeline**:
- Extracts face region from frame using MediaPipe detection results
- Resizes to 224x224 (adjust based on your model)
- Normalizes pixel values to [0, 1]
- Adds batch dimension

**Integration Points**:
- Receives `videoElement` and `faceDetectionResult` props
- Emits `onInferenceResult(result)` with predictions
- Emits `onError(message)` for errors

### 4. ResultsVisualization Component
**Location**: `src/components/ResultsVisualization/`

**Purpose**: Display real-time detection results and confidence scores.

**Key Features**:
- Real-time confidence score display
- Color-coded threat levels (green/yellow/red)
- Detection history tracking (last 50 results)
- Statistics aggregation
- Interpretation guide

**Confidence Thresholds**:
- 0-30%: Likely authentic (green)
- 30-60%: Uncertain (yellow)
- 60-100%: Likely deepfake (red)

**Integration Points**:
- Receives `latestResult` and `history` props
- Pure presentation component

## Application Flow

```
1. User Input (VideoInput)
   ↓
2. Video Element Ready
   ↓
3. Face Detection (MediaPipe)
   ↓
4. Face Detected with Bounding Box
   ↓
5. ML Inference (TensorFlow.js)
   ↓
6. Detection Result
   ↓
7. Results Visualization
```

## Type Definitions

**Location**: `src/types/index.ts`

Key types:
- `DetectionResult`: Model inference output
- `FaceDetectionResult`: MediaPipe face detection output
- `VideoSource`: Video input source metadata
- `ModelConfig`: Model configuration options

## Performance Considerations

### Face Detection
- Runs continuously on every frame (requestAnimationFrame)
- ~30-60 FPS depending on hardware
- Uses GPU acceleration via WebGL

### ML Inference
- Runs every 500ms (configurable)
- Adjust interval based on model size:
  - Lightweight models (< 5MB): 250-500ms
  - Medium models (5-20MB): 500-1000ms
  - Heavy models (> 20MB): 1000-2000ms

### Memory Management
- Detection history limited to 50 results
- Proper tensor disposal after each inference
- Stream cleanup on component unmount

## Browser Compatibility

### Required Features
- WebGL 2.0 (for TensorFlow.js)
- MediaStream API (for webcam)
- File API (for video upload)
- ES6+ JavaScript support

### Recommended Browsers
- Chrome/Edge 90+ (best performance)
- Firefox 88+
- Safari 14.1+ (limited MediaPipe support)

## Development Workflow

### Local Development
```bash
npm run dev        # Start dev server on http://localhost:5173
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Adding a New Component
```typescript
// 1. Create component directory
mkdir -p src/components/NewComponent

// 2. Create component file
// src/components/NewComponent/NewComponent.tsx
import React from 'react';

interface NewComponentProps {
  // Define props
}

const NewComponent: React.FC<NewComponentProps> = ({ ... }) => {
  return (
    <div className="...">
      {/* Component content */}
    </div>
  );
};

export default NewComponent;

// 3. Create index file
// src/components/NewComponent/index.ts
export { default } from './NewComponent';

// 4. Import in App.tsx
import NewComponent from './components/NewComponent';
```

## Debugging Tips

### MediaPipe Issues
- Check browser console for CORS errors
- Verify model URL is accessible
- Consider hosting models locally for production

### TensorFlow.js Issues
- Check WebGL support: `await tf.setBackend('webgl')`
- Monitor memory usage: `tf.memory()`
- Verify tensor shapes match model input

### Performance Issues
- Use Chrome DevTools Performance tab
- Enable React DevTools Profiler
- Monitor inference time in ML Inference component

## Security Considerations

### Content Security Policy
```html
<!-- Add to index.html if needed -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-eval'; 
               worker-src 'self' blob:; 
               connect-src 'self' https://storage.googleapis.com https://cdn.jsdelivr.net;">
```

### Camera Permissions
- Always request user consent
- Provide clear explanation of camera usage
- Implement fallback for denied permissions

### Data Privacy
- Process video frames client-side only
- Never upload video data without explicit consent
- Clear video stream on component unmount

## Testing Strategy

### Unit Tests
```typescript
// Example test structure
describe('MLInference', () => {
  it('should preprocess frames correctly', async () => {
    // Test preprocessing logic
  });
  
  it('should dispose tensors properly', () => {
    // Test memory management
  });
});
```

### Integration Tests
- Test component interactions
- Verify data flow between components
- Test error handling

### E2E Tests
- Test with real webcam feed
- Test with sample video files
- Verify detection pipeline end-to-end

## Deployment

### Production Checklist
- [ ] Host MediaPipe models locally
- [ ] Train and integrate actual deepfake detection model
- [ ] Optimize bundle size (code splitting)
- [ ] Enable production build optimizations
- [ ] Set up CDN for static assets
- [ ] Configure proper CSP headers
- [ ] Add error tracking (e.g., Sentry)
- [ ] Implement analytics
- [ ] Add loading states
- [ ] Optimize for mobile devices

### Build Configuration
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'tf': ['@tensorflow/tfjs'],
          'mediapipe': ['@mediapipe/tasks-vision'],
        }
      }
    }
  }
});
```

## Future Enhancements

### Short Term
- [ ] Add video timeline scrubbing
- [ ] Implement batch processing
- [ ] Add confidence threshold controls
- [ ] Export results to CSV/JSON
- [ ] Add dark mode support

### Medium Term
- [ ] Multi-face tracking
- [ ] Advanced visualization options
- [ ] Real-time alerts system
- [ ] Integration with cloud ML services
- [ ] Mobile app version

### Long Term
- [ ] Train multiple specialized models
- [ ] Ensemble predictions
- [ ] Explainable AI features
- [ ] Video annotation tools
- [ ] API for third-party integration

## Resources

### Documentation
- [TensorFlow.js Guide](https://www.tensorflow.org/js/guide)
- [MediaPipe Documentation](https://developers.google.com/mediapipe)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

### Model Training
- [FaceForensics++ Dataset](https://github.com/ondyari/FaceForensics)
- [Celeb-DF Dataset](https://github.com/yuezunli/celeb-deepfakeforensics)
- [DFDC Dataset (Facebook)](https://ai.facebook.com/datasets/dfdc/)
- [TensorFlow Model Zoo](https://www.tensorflow.org/lite/models)
- [Transfer Learning Guide](https://www.tensorflow.org/tutorials/images/transfer_learning)

### Community
- [TensorFlow.js Discord](https://discord.gg/tensorflow)
- [MediaPipe Discussions](https://github.com/google/mediapipe/discussions)

## Troubleshooting

### Common Issues

**Issue**: MediaPipe model fails to load
```
Solution: Host models locally or check CDN availability
```

**Issue**: TensorFlow.js WebGL backend fails
```
Solution: Fallback to CPU backend or check GPU drivers
```

**Issue**: High memory usage
```
Solution: Verify tensor disposal and reduce history size
```

**Issue**: Low inference FPS
```
Solution: Reduce input resolution or inference frequency
```

## Contributing

This is a research project. When contributing:
1. Follow the existing component structure
2. Add comprehensive TODO comments
3. Update type definitions
4. Test with real video sources
5. Document any new dependencies
6. Update this guide with new features

## License

See LICENSE file for details.
