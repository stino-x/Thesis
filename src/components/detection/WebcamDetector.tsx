/**
 * Webcam Detector Component
 * 
 * Real-time deepfake detection using webcam stream
 * Features:
 * - Live video preview with overlay
 * - Real-time face detection and analysis
 * - Continuous monitoring mode
 * - Results display with confidence scores
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Video, VideoOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { getWebcamStream, stopMediaStream } from '@/utils/videoUtils';
import { drawBoundingBox, drawLandmarks, drawConfidenceOverlay } from '@/utils/canvasUtils';
import { getFaceDetector, getFaceMesh, FeatureAggregator } from '@/lib/mediapipe';
import { getDeepfakeDetector } from '@/lib/tensorflow';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { DetectionResult } from '@/lib/tensorflow/detector';

const WebcamDetector = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const [isActive, setIsActive] = useState(false);
  const [currentResult, setCurrentResult] = useState<DetectionResult | null>(null);
  const [fps, setFps] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);
  const [detectionCount, setDetectionCount] = useState(0);

  const { logDetection, getTimingHelper } = useAuditLog();
  const featureAggregator = useRef(new FeatureAggregator());
  const lastProcessTime = useRef(Date.now());
  const frameCount = useRef(0);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await getWebcamStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      toast.success('Webcam started successfully');

      if (continuousMode) {
        startDetection();
      }
    } catch (error) {
      console.error('Failed to start webcam:', error);
      toast.error('Failed to access webcam. Please check permissions.');
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    featureAggregator.current.reset();
    toast.info('Webcam stopped');
  };

  const startDetection = () => {
    processFrame();
  };

  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Update canvas size
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Process every 100ms for performance
    const now = Date.now();
    if (now - lastProcessTime.current >= 100) {
      await detectInFrame(canvas, ctx);
      lastProcessTime.current = now;

      // Calculate FPS
      frameCount.current++;
      if (frameCount.current % 10 === 0) {
        const elapsed = (now - lastProcessTime.current + 1000) / 1000;
        setFps(Math.round(10 / elapsed));
      }
    }

    // Continue processing
    if (continuousMode && isActive) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  };

  const detectInFrame = async (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const timer = getTimingHelper();

    try {
      // 1. Face Detection
      const faceDetector = getFaceDetector();
      await faceDetector.waitForInitialization();
      const faces = await faceDetector.detect(videoRef.current!);

      if (!faces[0]?.detected) {
        setCurrentResult(null);
        return;
      }

      const face = faces[0];

      // 2. Face Mesh
      const faceMesh = getFaceMesh();
      await faceMesh.waitForInitialization();
      const meshResult = await faceMesh.detect(videoRef.current!);

      if (!meshResult.detected || !meshResult.landmarks) {
        setCurrentResult(null);
        return;
      }

      // 3. Extract Features
      const eyeLandmarks = faceMesh.getEyeLandmarks(meshResult.landmarks);
      const leftEAR = faceMesh.calculateEyeAspectRatio(eyeLandmarks.leftEye);
      const rightEAR = faceMesh.calculateEyeAspectRatio(eyeLandmarks.rightEye);

      featureAggregator.current.processFrame(meshResult.landmarks, leftEAR, rightEAR);
      const features = featureAggregator.current.getFeatures(meshResult.landmarks);

      // 4. Classify
      const detector = getDeepfakeDetector();
      await detector.waitForInitialization();
      const result = await detector.detectFromFeatures(features);

      setCurrentResult(result);
      setDetectionCount(prev => prev + 1);

      // 5. Draw Overlay
      if (showOverlay && face.boundingBox) {
        const bbox = face.boundingBox;
        const color = result.isDeepfake ? '#ff0000' : '#00ff00';

        drawBoundingBox(
          ctx,
          {
            x: bbox.xMin * canvas.width,
            y: bbox.yMin * canvas.height,
            width: bbox.width * canvas.width,
            height: bbox.height * canvas.height,
          },
          color,
          3
        );

        // Draw landmarks
        const scaledLandmarks = meshResult.landmarks.map(lm => ({
          x: lm.x * canvas.width,
          y: lm.y * canvas.height,
        }));
        drawLandmarks(ctx, scaledLandmarks, color, 1);

        // Draw confidence
        drawConfidenceOverlay(ctx, result.confidence, result.isDeepfake, 10, 40);
      }

      // 6. Log Detection (every 10th frame to avoid spam)
      if (detectionCount % 10 === 0) {
        await logDetection({
          detection_type: 'webcam',
          media_type: 'video/webm',
          file_name: `webcam_snapshot_${Date.now()}.jpg`,
          file_size: 0,
          detection_result: result.isDeepfake ? 'deepfake' : 'real',
          confidence_score: result.confidence,
          processing_time_ms: timer.getElapsedMs(),
          metadata: {
            face_detected: true,
            features_analyzed: Object.keys(features),
            anomalies_detected: result.anomalies,
            blink_rate: features.blinkRate,
            landmark_jitter: features.landmarkJitter,
          },
        });
      }
    } catch (error) {
      console.error('Detection error:', error);
    }
  };

  const captureSnapshot = async () => {
    if (!canvasRef.current) return;

    const timer = getTimingHelper();

    try {
      const canvas = canvasRef.current;
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
      });

      // Save detection
      if (currentResult) {
        await logDetection({
          detection_type: 'webcam',
          media_type: 'image/jpeg',
          file_name: `webcam_snapshot_${Date.now()}.jpg`,
          file_size: blob.size,
          detection_result: currentResult.isDeepfake ? 'deepfake' : 'real',
          confidence_score: currentResult.confidence,
          processing_time_ms: timer.getElapsedMs(),
          metadata: {
            face_detected: true,
            anomalies_detected: currentResult.anomalies,
            snapshot: true,
          },
        });
      }

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshot_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Snapshot captured and logged');
    } catch (error) {
      console.error('Snapshot error:', error);
      toast.error('Failed to capture snapshot');
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Live Webcam Detection</CardTitle>
          <CardDescription>
            Real-time deepfake detection using your webcam
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Controls */}
          <div className="flex flex-wrap gap-3">
            {!isActive ? (
              <Button onClick={startWebcam} className="gap-2">
                <Video className="h-4 w-4" />
                Start Webcam
              </Button>
            ) : (
              <Button onClick={stopWebcam} variant="destructive" className="gap-2">
                <VideoOff className="h-4 w-4" />
                Stop Webcam
              </Button>
            )}

            <Button
              onClick={captureSnapshot}
              disabled={!isActive || !currentResult}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Capture Snapshot
            </Button>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="overlay"
                checked={showOverlay}
                onCheckedChange={setShowOverlay}
              />
              <Label htmlFor="overlay">Show Overlay</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="continuous"
                checked={continuousMode}
                onCheckedChange={setContinuousMode}
              />
              <Label htmlFor="continuous">Continuous Detection</Label>
            </div>
          </div>

          {/* Stats */}
          {isActive && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>FPS: {fps}</span>
              <span>Detections: {detectionCount}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Video Display */}
        <Card>
          <CardHeader>
            <CardTitle>Live Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {!isActive && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Webcam not active</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Display */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Results</CardTitle>
          </CardHeader>
          <CardContent>
            {currentResult ? (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-3">
                  {currentResult.isDeepfake ? (
                    <>
                      <AlertCircle className="h-8 w-8 text-red-500" />
                      <div>
                        <Badge variant="destructive" className="text-lg px-3 py-1">
                          DEEPFAKE DETECTED
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                      <div>
                        <Badge className="text-lg px-3 py-1">
                          AUTHENTIC
                        </Badge>
                      </div>
                    </>
                  )}
                </div>

                {/* Confidence Score */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Confidence</span>
                    <span className="font-medium">
                      {(currentResult.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={currentResult.confidence * 100}
                    className="h-2"
                  />
                </div>

                {/* Scores Breakdown */}
                {currentResult.scores && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Score Breakdown</h4>
                    {Object.entries(currentResult.scores).map(([key, value]) => (
                      value !== undefined && (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span>{(value * 100).toFixed(1)}%</span>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {/* Anomalies */}
                {currentResult.anomalies.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Detected Anomalies</h4>
                    <ul className="space-y-1">
                      {currentResult.anomalies.map((anomaly, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          • {anomaly.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No face detected</p>
                <p className="text-sm mt-2">
                  Position your face in the camera view
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WebcamDetector;
