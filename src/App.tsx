import { useState, useCallback } from 'react';
import VideoInput from './components/VideoInput';
import FaceDetection from './components/FaceDetection';
import MLInference from './components/MLInference';
import ResultsVisualization from './components/ResultsVisualization';
import type { FaceDetectionResult, DetectionResult } from './types';

function App() {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const [faceDetectionResult, setFaceDetectionResult] = useState<FaceDetectionResult | null>(null);
  const [latestResult, setLatestResult] = useState<DetectionResult | null>(null);
  const [resultHistory, setResultHistory] = useState<DetectionResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    setVideoElement(video);
    setIsDetectionActive(true);
    setErrors([]);
  }, []);

  const handleFaceDetected = useCallback((result: FaceDetectionResult) => {
    setFaceDetectionResult(result);
  }, []);

  const handleInferenceResult = useCallback((result: DetectionResult) => {
    setLatestResult(result);
    setResultHistory(prev => {
      const newHistory = [...prev, result];
      // Keep only last 50 results to prevent memory issues
      return newHistory.slice(-50);
    });
  }, []);

  const handleError = useCallback((error: string) => {
    setErrors(prev => [...prev, error]);
    console.error('App error:', error);
  }, []);

  const clearErrors = () => {
    setErrors([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Deepfake Detection System
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Real-time video analysis using TensorFlow.js and MediaPipe
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-xs text-gray-500">Detection Status</p>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isDetectionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    {isDetectionActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error display */}
      {errors.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-semibold text-red-800">Errors Occurred</h3>
                <ul className="mt-2 list-disc list-inside text-sm text-red-700">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={clearErrors}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Video Input Component */}
          <VideoInput onVideoReady={handleVideoReady} onError={handleError} />

          {/* Face Detection Component */}
          <FaceDetection
            videoElement={videoElement}
            isActive={isDetectionActive}
            onFaceDetected={handleFaceDetected}
            onError={handleError}
          />

          {/* ML Inference Component */}
          <MLInference
            videoElement={videoElement}
            faceDetectionResult={faceDetectionResult}
            isActive={isDetectionActive}
            onInferenceResult={handleInferenceResult}
            onError={handleError}
          />

          {/* Results Visualization Component */}
          <ResultsVisualization
            latestResult={latestResult}
            history={resultHistory}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>
              Deepfake Detection System - Built with React, TypeScript, TensorFlow.js, and MediaPipe
            </p>
            <p className="mt-2">
              <span className="font-semibold">Note:</span> This is a research prototype.
              Results should be verified by experts.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
