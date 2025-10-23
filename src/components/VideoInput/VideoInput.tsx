import React, { useRef, useState, useEffect } from 'react';
import type { VideoSource } from '../../types';

interface VideoInputProps {
  onVideoReady: (video: HTMLVideoElement, source: VideoSource) => void;
  onError: (error: string) => void;
}

const VideoInput: React.FC<VideoInputProps> = ({ onVideoReady, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [currentSource, setCurrentSource] = useState<VideoSource | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup: Stop webcam stream when component unmounts
      if (currentSource?.stream) {
        currentSource.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentSource]);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        const source: VideoSource = { type: 'webcam', stream };
        setCurrentSource(source);
        setIsWebcamActive(true);

        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            onVideoReady(videoRef.current, source);
          }
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access webcam';
      onError(errorMessage);
      console.error('Webcam access error:', err);
    }
  };

  const stopWebcam = () => {
    if (currentSource?.stream) {
      currentSource.stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setCurrentSource(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Stop any existing webcam stream
    if (isWebcamActive) {
      stopWebcam();
    }

    if (!file.type.startsWith('video/')) {
      onError('Please select a valid video file');
      return;
    }

    const url = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();

      const source: VideoSource = { type: 'upload', file };
      setCurrentSource(source);

      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          onVideoReady(videoRef.current, source);
        }
      };
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Video Input</h2>
        
        {/* Control buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={isWebcamActive ? stopWebcam : startWebcam}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              isWebcamActive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isWebcamActive ? 'Stop Webcam' : 'Start Webcam'}
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
            disabled={isWebcamActive}
          >
            Upload Video
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Video display */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            muted
            loop={currentSource?.type === 'upload'}
          />
          {!currentSource && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-lg">No video source selected</p>
                <p className="text-sm mt-2">Start webcam or upload a video</p>
              </div>
            </div>
          )}
        </div>

        {/* Video info */}
        {currentSource && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Source:</span>{' '}
              {currentSource.type === 'webcam' ? 'Live Webcam' : currentSource.file?.name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoInput;
