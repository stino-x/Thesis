# Deepfake Detection System

A real-time deepfake detection web application built with React, TypeScript, TensorFlow.js, and MediaPipe.

## Features

- **Video Input**: Support for both webcam streaming and video file uploads
- **Face Detection**: Real-time face detection using MediaPipe Face Detection
- **ML Inference Pipeline**: TensorFlow.js-based inference pipeline for deepfake detection
- **Results Visualization**: Real-time confidence scores and detection history
- **Modern UI**: Responsive design with Tailwind CSS

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **ML Framework**: TensorFlow.js
- **Face Detection**: MediaPipe Tasks Vision
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── VideoInput/          # Video input component (webcam/upload)
│   ├── FaceDetection/       # MediaPipe face detection
│   ├── MLInference/         # TensorFlow.js inference pipeline
│   └── ResultsVisualization/ # Results display with confidence scores
├── types/                   # TypeScript type definitions
├── App.tsx                  # Main application component
└── main.tsx                 # Application entry point
```

## Model Integration

The application includes a complete inference pipeline ready for model integration:

### TODO: Integrate Your Trained Model

1. **Train a deepfake detection model** using your preferred framework (TensorFlow, PyTorch, etc.)
2. **Convert to TensorFlow.js format** using the tfjs-converter:
   ```bash
   tensorflowjs_converter --input_format=tf_saved_model \
                         --output_format=tfjs_graph_model \
                         /path/to/saved_model \
                         /path/to/web_model
   ```
3. **Host model files** (model.json and weight shards) in the `public/models/` directory
4. **Update the MODEL_URL** in `src/components/MLInference/MLInference.tsx`
5. **Uncomment model loading code** and adjust preprocessing as needed

### Current Status

The application currently runs with a **mock inference pipeline** that demonstrates the complete workflow. The inference component includes:

- Proper frame preprocessing (cropping, resizing, normalization)
- Face-based region extraction
- Batch processing setup
- Performance monitoring
- Clear TODO comments for model integration

## Usage

1. **Start Video Input**:
   - Click "Start Webcam" for live video
   - Or click "Upload Video" to analyze a video file

2. **Face Detection**:
   - The system automatically detects faces in real-time
   - Green bounding boxes show detected faces

3. **View Results**:
   - Real-time confidence scores (0-100%)
   - Color-coded threat levels (Green/Yellow/Red)
   - Detection history with timestamps
   - Performance statistics

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Adding Tests

```bash
# Install testing dependencies
npm install -D @testing-library/react @testing-library/jest-dom vitest

# Add test scripts to package.json
```

## Performance Considerations

- Face detection runs continuously on video frames
- ML inference runs every 500ms (configurable)
- TensorFlow.js uses WebGL backend for GPU acceleration
- Results history is limited to 50 entries to prevent memory issues

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari (with limitations on some MediaPipe features)

## Known Limitations

- Requires camera permissions for webcam access
- Model performance depends on hardware (GPU recommended)
- MediaPipe models are loaded from CDN (consider hosting locally for production)

## Future Enhancements

- [ ] Model training pipeline integration
- [ ] Batch video processing
- [ ] Advanced visualization options
- [ ] Export results to CSV/JSON
- [ ] Multi-face tracking
- [ ] Video timeline scrubbing
- [ ] Custom confidence thresholds

## Contributing

This is a research project. Feel free to extend and modify as needed.

## License

See LICENSE file for details.

## Acknowledgments

- TensorFlow.js team for the ML framework
- MediaPipe team for face detection models
- React and Vite communities 
