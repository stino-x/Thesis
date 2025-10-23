import React, { useState, useEffect } from 'react';
import type { DetectionResult } from '../../types';

interface ResultsVisualizationProps {
  latestResult: DetectionResult | null;
  history: DetectionResult[];
}

const ResultsVisualization: React.FC<ResultsVisualizationProps> = ({
  latestResult,
  history,
}) => {
  const [averageConfidence, setAverageConfidence] = useState(0);
  const [deepfakeCount, setDeepfakeCount] = useState(0);

  useEffect(() => {
    if (history.length === 0) return;

    const total = history.reduce((sum, result) => sum + result.confidence, 0);
    const avg = total / history.length;
    setAverageConfidence(avg);

    const deepfakes = history.filter(result => result.isDeepfake).length;
    setDeepfakeCount(deepfakes);
  }, [history]);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence < 0.3) return 'text-green-600';
    if (confidence < 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBgColor = (confidence: number): string => {
    if (confidence < 0.3) return 'bg-green-100';
    if (confidence < 0.6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getConfidenceBorderColor = (confidence: number): string => {
    if (confidence < 0.3) return 'border-green-400';
    if (confidence < 0.6) return 'border-yellow-400';
    return 'border-red-400';
  };

  const getStatusLabel = (isDeepfake: boolean): string => {
    return isDeepfake ? 'POTENTIAL DEEPFAKE' : 'LIKELY AUTHENTIC';
  };

  const getStatusColor = (isDeepfake: boolean): string => {
    return isDeepfake ? 'text-red-600' : 'text-green-600';
  };

  const getStatusBg = (isDeepfake: boolean): string => {
    return isDeepfake ? 'bg-red-100' : 'bg-green-100';
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Detection Results</h2>

        {/* Current result */}
        {latestResult ? (
          <div
            className={`mb-6 p-4 rounded-lg border-l-4 ${getConfidenceBgColor(
              latestResult.confidence
            )} ${getConfidenceBorderColor(latestResult.confidence)}`}
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase">Current Status</h3>
                <p className={`text-2xl font-bold ${getStatusColor(latestResult.isDeepfake)}`}>
                  {getStatusLabel(latestResult.isDeepfake)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-600">Confidence Score</p>
                <p className={`text-3xl font-bold ${getConfidenceColor(latestResult.confidence)}`}>
                  {(latestResult.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Confidence meter */}
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    latestResult.confidence < 0.3
                      ? 'bg-green-500'
                      : latestResult.confidence < 0.6
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${latestResult.confidence * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>Authentic</span>
                <span>Uncertain</span>
                <span>Deepfake</span>
              </div>
            </div>

            {!latestResult.faceDetected && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  ⚠️ No face detected in current frame
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 p-6 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-500">No detection results yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Start video input and enable detection to see results
            </p>
          </div>
        )}

        {/* Statistics */}
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-600 uppercase font-semibold">Total Analyzed</p>
              <p className="text-2xl font-bold text-blue-600">{history.length}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-600 uppercase font-semibold">Avg Confidence</p>
              <p className="text-2xl font-bold text-purple-600">
                {(averageConfidence * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-600 uppercase font-semibold">Deepfake Alerts</p>
              <p className="text-2xl font-bold text-orange-600">{deepfakeCount}</p>
            </div>
          </div>
        )}

        {/* Recent history */}
        {history.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-700">Recent Detections</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.slice(-10).reverse().map((result, index) => (
                <div
                  key={`${result.timestamp}-${index}`}
                  className={`p-3 rounded-lg flex justify-between items-center ${getStatusBg(
                    result.isDeepfake
                  )}`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        result.isDeepfake ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    />
                    <span className={`text-sm font-semibold ${getStatusColor(result.isDeepfake)}`}>
                      {getStatusLabel(result.isDeepfake)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`text-sm font-bold ${getConfidenceColor(result.confidence)}`}>
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interpretation guide */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">How to Interpret Results</h4>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-start space-x-2">
              <span className="text-green-600 font-bold">●</span>
              <p>
                <span className="font-semibold">0-30% (Green):</span> Video appears authentic with
                high confidence
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-yellow-600 font-bold">●</span>
              <p>
                <span className="font-semibold">30-60% (Yellow):</span> Uncertain - requires manual
                review
              </p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-red-600 font-bold">●</span>
              <p>
                <span className="font-semibold">60-100% (Red):</span> High likelihood of
                manipulation detected
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
          <p className="text-xs text-yellow-800">
            <span className="font-bold">Note:</span> This is a demonstration system. Results are for
            research purposes only and should not be used as definitive proof. Always verify with
            multiple sources and expert analysis.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultsVisualization;
