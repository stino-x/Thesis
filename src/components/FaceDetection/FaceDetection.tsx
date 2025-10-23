import React, { useRef, useEffect, useState } from 'react';
import { FaceDetector, FilesetResolver, type Detection } from '@mediapipe/tasks-vision';
import type { FaceDetectionResult } from '../../types';

interface FaceDetectionProps {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  onFaceDetected: (result: FaceDetectionResult) => void;
  onError: (error: string) => void;
}

const FaceDetection: React.FC<FaceDetectionProps> = ({
  videoElement,
  isActive,
  onFaceDetected,
  onError,
}) => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [detectionStats, setDetectionStats] = useState({
    totalFrames: 0,
    facesDetected: 0,
  });
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // TODO: Download the MediaPipe Face Detection model
  // For production, download the model file and host it locally
  // Model can be downloaded from: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite
  const MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

  useEffect(() => {
    const initializeFaceDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });

        faceDetectorRef.current = detector;
        setIsModelLoaded(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load face detection model';
        onError(errorMessage);
        console.error('Face detector initialization error:', err);
      }
    };

    initializeFaceDetector();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onError]);

  useEffect(() => {
    if (!isActive || !videoElement || !faceDetectorRef.current || !isModelLoaded) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const drawDetections = (detections: Detection[]) => {
      if (!canvasRef.current || !videoElement) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      detections.forEach(detection => {
        const box = detection.boundingBox;
        if (!box) return;

        // Draw bounding box
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.originX, box.originY, box.width, box.height);

        // Draw keypoints if available
        if (detection.keypoints) {
          ctx.fillStyle = '#ff0000';
          detection.keypoints.forEach(keypoint => {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
        }
      });
    };

    const clearCanvas = () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };

    const detectFaces = async () => {
      if (!videoElement || !faceDetectorRef.current || videoElement.paused || videoElement.ended) {
        return;
      }

      try {
        const startTimeMs = performance.now();
        const detections = faceDetectorRef.current.detectForVideo(videoElement, startTimeMs);

        setDetectionStats(prev => ({
          totalFrames: prev.totalFrames + 1,
          facesDetected: prev.facesDetected + (detections.detections.length > 0 ? 1 : 0),
        }));

        if (detections.detections.length > 0) {
          const detection = detections.detections[0];
          const boundingBox = detection.boundingBox;

          const result: FaceDetectionResult = {
            detected: true,
            boundingBox: boundingBox ? {
              x: boundingBox.originX,
              y: boundingBox.originY,
              width: boundingBox.width,
              height: boundingBox.height,
            } : undefined,
            landmarks: detection.keypoints?.map(kp => ({ x: kp.x, y: kp.y })),
          };

          onFaceDetected(result);
          drawDetections(detections.detections);
        } else {
          onFaceDetected({ detected: false });
          clearCanvas();
        }
      } catch (err) {
        console.error('Face detection error:', err);
      }

      animationFrameRef.current = requestAnimationFrame(detectFaces);
    };

    detectFaces();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, videoElement, isModelLoaded, onFaceDetected]);

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Face Detection</h2>

        {/* Model status */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">Model Status:</span>
            <span
              className={`text-sm font-semibold ${
                isModelLoaded ? 'text-green-600' : 'text-yellow-600'
              }`}
            >
              {isModelLoaded ? '✓ Loaded' : 'Loading...'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-semibold text-gray-600">Detection Active:</span>
            <span
              className={`text-sm font-semibold ${
                isActive && isModelLoaded ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {isActive && isModelLoaded ? '● Active' : '○ Inactive'}
            </span>
          </div>
        </div>

        {/* Statistics */}
        {detectionStats.totalFrames > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600">Total Frames</p>
                <p className="text-xl font-bold text-blue-600">{detectionStats.totalFrames}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Faces Detected</p>
                <p className="text-xl font-bold text-blue-600">{detectionStats.facesDetected}</p>
              </div>
            </div>
          </div>
        )}

        {/* Canvas for drawing detections (hidden, used for overlay) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Info */}
        <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">Note:</span> Face detection runs in real-time using MediaPipe.
            Detected faces will be highlighted with bounding boxes.
          </p>
        </div>

        {/* TODO comment for developers */}
        <div className="mt-4 p-3 bg-gray-100 border-l-4 border-gray-400">
          <p className="text-xs text-gray-700 font-mono">
            <span className="font-bold">TODO:</span> For production deployment, download and host the MediaPipe model locally
            instead of loading from CDN. Update MODEL_PATH constant with local path.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FaceDetection;
