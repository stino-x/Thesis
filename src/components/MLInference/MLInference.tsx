import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import type { DetectionResult, FaceDetectionResult } from '../../types';

interface MLInferenceProps {
  videoElement: HTMLVideoElement | null;
  faceDetectionResult: FaceDetectionResult | null;
  isActive: boolean;
  onInferenceResult: (result: DetectionResult) => void;
  onError: (error: string) => void;
}

const MLInference: React.FC<MLInferenceProps> = ({
  videoElement,
  faceDetectionResult,
  isActive,
  onInferenceResult,
  onError,
}) => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [modelInfo, setModelInfo] = useState<string>('No model loaded');
  const [inferenceStats, setInferenceStats] = useState({
    totalInferences: 0,
    avgInferenceTime: 0,
  });
  const modelRef = useRef<tf.LayersModel | null>(null);
  const inferenceIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // TODO: Replace this with your actual trained deepfake detection model
  // This is a placeholder that demonstrates the model loading and inference pipeline
  // You need to:
  // 1. Train a deepfake detection model (e.g., using CNN, ResNet, EfficientNet)
  // 2. Convert it to TensorFlow.js format (using tfjs-converter)
  // 3. Host the model files (model.json and weight shards)
  // 4. Update the MODEL_URL below to point to your model
  // @ts-expect-error - MODEL_URL is a placeholder for future model integration
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const MODEL_URL = null; // Replace with your model URL, e.g., '/models/deepfake-detector/model.json'

  useEffect(() => {
    const initializeModel = async () => {
      try {
        // Set TensorFlow.js backend
        await tf.ready();
        await tf.setBackend('webgl');
        
        setModelInfo(`TensorFlow.js ${tf.version.tfjs} initialized with ${tf.getBackend()} backend`);

        // TODO: Load your actual model here
        // Uncomment and modify the following code when you have a trained model:
        /*
        if (MODEL_URL) {
          const model = await tf.loadLayersModel(MODEL_URL);
          modelRef.current = model;
          setIsModelLoaded(true);
          setModelInfo(`Model loaded: ${model.inputs[0].shape?.join('x') || 'unknown'} input shape`);
        } else {
          setModelInfo('No model URL configured - using mock inference');
        }
        */
        
        // For now, mark as "loaded" to demonstrate the pipeline
        setIsModelLoaded(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize TensorFlow.js';
        onError(errorMessage);
        console.error('Model initialization error:', err);
      }
    };

    initializeModel();

    return () => {
      if (inferenceIntervalRef.current) {
        clearInterval(inferenceIntervalRef.current);
      }
      // Cleanup tensors
      const model = modelRef.current;
      if (model) {
        model.dispose();
      }
    };
  }, [onError]);

  useEffect(() => {
    if (!isActive || !videoElement || !isModelLoaded) {
      if (inferenceIntervalRef.current) {
        clearInterval(inferenceIntervalRef.current);
      }
      return;
    }

    const runInference = async () => {
      if (!videoElement || !faceDetectionResult?.detected) {
        return;
      }

      const startTime = performance.now();

      try {
        // TODO: Replace this mock inference with actual model inference
        // This is a placeholder that demonstrates the inference pipeline structure
        
        // Step 1: Preprocess the video frame
        const tensor = await preprocessFrame(videoElement, faceDetectionResult);
        
        if (tensor) {
          // Step 2: Run model inference
          // Uncomment and modify when you have a trained model:
          /*
          if (modelRef.current) {
            const prediction = modelRef.current.predict(tensor) as tf.Tensor;
            const predictionData = await prediction.data();
            const confidence = predictionData[0]; // Assuming binary classification
            const isDeepfake = confidence > 0.5;
            
            prediction.dispose();
          }
          */
          
          // Mock inference result for demonstration
          const mockConfidence = 0.15 + Math.random() * 0.3; // Random confidence between 0.15-0.45 (likely real)
          const result: DetectionResult = {
            isDeepfake: mockConfidence > 0.5,
            confidence: mockConfidence,
            timestamp: Date.now(),
            faceDetected: true,
          };
          
          onInferenceResult(result);
          
          tensor.dispose();
        }

        const inferenceTime = performance.now() - startTime;
        setInferenceStats(prev => ({
          totalInferences: prev.totalInferences + 1,
          avgInferenceTime: (prev.avgInferenceTime * prev.totalInferences + inferenceTime) / (prev.totalInferences + 1),
        }));
      } catch (err) {
        console.error('Inference error:', err);
      }
    };

    // Run inference every 500ms (adjustable based on performance needs)
    inferenceIntervalRef.current = setInterval(() => {
      runInference();
    }, 500);

    return () => {
      if (inferenceIntervalRef.current) {
        clearInterval(inferenceIntervalRef.current);
      }
    };
  }, [isActive, videoElement, isModelLoaded, faceDetectionResult, onInferenceResult]);

  const preprocessFrame = async (
    video: HTMLVideoElement,
    faceResult: FaceDetectionResult
  ): Promise<tf.Tensor | null> => {
    try {
      // Create a tensor from the video frame
      let tensor = tf.browser.fromPixels(video);

      // If face is detected, crop to the face region
      if (faceResult.boundingBox) {
        const { x, y, width, height } = faceResult.boundingBox;
        // Ensure coordinates are within bounds
        const cropX = Math.max(0, Math.floor(x));
        const cropY = Math.max(0, Math.floor(y));
        const cropWidth = Math.min(video.videoWidth - cropX, Math.floor(width));
        const cropHeight = Math.min(video.videoHeight - cropY, Math.floor(height));

        if (cropWidth > 0 && cropHeight > 0) {
          const cropped = tf.image.cropAndResize(
            tensor.expandDims(0) as tf.Tensor4D,
            [[cropY / video.videoHeight, cropX / video.videoWidth, 
              (cropY + cropHeight) / video.videoHeight, (cropX + cropWidth) / video.videoWidth]],
            [0],
            [224, 224] // Standard input size for many models
          );
          tensor.dispose();
          tensor = cropped.squeeze();
        }
      } else {
        // Resize entire frame if no face detected
        tensor = tf.image.resizeBilinear(tensor, [224, 224]);
      }

      // Normalize to [0, 1] or [-1, 1] depending on your model's requirements
      tensor = tensor.div(255.0);

      // Add batch dimension
      tensor = tensor.expandDims(0);

      return tensor;
    } catch (err) {
      console.error('Preprocessing error:', err);
      return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">ML Inference Pipeline</h2>

        {/* Model status */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600">TensorFlow.js Status:</span>
            <span
              className={`text-sm font-semibold ${
                isModelLoaded ? 'text-green-600' : 'text-yellow-600'
              }`}
            >
              {isModelLoaded ? '✓ Ready' : 'Initializing...'}
            </span>
          </div>
          <p className="text-xs text-gray-500">{modelInfo}</p>
        </div>

        {/* Inference statistics */}
        {inferenceStats.totalInferences > 0 && (
          <div className="mb-4 p-3 bg-purple-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600">Total Inferences</p>
                <p className="text-xl font-bold text-purple-600">{inferenceStats.totalInferences}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Avg Time (ms)</p>
                <p className="text-xl font-bold text-purple-600">
                  {inferenceStats.avgInferenceTime.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline info */}
        <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Pipeline Status:</span> The inference pipeline is ready.
            {isActive && faceDetectionResult?.detected
              ? ' Running inference on detected faces.'
              : ' Waiting for face detection.'}
          </p>
        </div>

        {/* TODO comments for developers */}
        <div className="mt-4 p-3 bg-gray-100 border-l-4 border-gray-400">
          <p className="text-xs text-gray-700 font-mono mb-2">
            <span className="font-bold">TODO - Model Integration Steps:</span>
          </p>
          <ol className="text-xs text-gray-700 font-mono list-decimal list-inside space-y-1">
            <li>Train a deepfake detection model (CNN/ResNet/EfficientNet)</li>
            <li>Convert model to TensorFlow.js format using tfjs-converter</li>
            <li>Host model files (model.json + weight shards)</li>
            <li>Update MODEL_URL constant with your model path</li>
            <li>Uncomment model loading code in initializeModel()</li>
            <li>Uncomment inference code in runInference()</li>
            <li>Adjust preprocessing to match your model's input requirements</li>
            <li>Update confidence threshold based on your model's performance</li>
          </ol>
        </div>

        {/* Performance considerations */}
        <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">Performance:</span> Inference runs every 500ms.
            Adjust the interval based on your model's size and target framerate.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MLInference;
