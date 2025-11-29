/**
 * Video Analyzer Component
 * 
 * Upload and analyze videos for deepfake detection
 * Features:
 * - Video upload with validation
 * - Frame-by-frame analysis
 * - Temporal consistency checks
 * - Timeline visualization
 * - Suspicious segment highlighting
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Upload, Video as VideoIcon, AlertCircle, CheckCircle, Download, Play, Pause, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { loadVideo, extractFrames, validateVideoFile, formatFileSize, formatDuration } from '@/utils/videoUtils';
import { getDeepfakeDetector, canvasToTensor } from '@/lib/tensorflow';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { DetectionResult } from '@/lib/tensorflow/detector';

interface FrameResult {
  frameIndex: number;
  timestamp: number;
  result: DetectionResult;
}

interface SuspiciousSegment {
  startTime: number;
  endTime: number;
  avgConfidence: number;
  frameCount: number;
}

const VideoAnalyzer = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [frameResults, setFrameResults] = useState<FrameResult[]>([]);
  const [overallResult, setOverallResult] = useState<DetectionResult | null>(null);
  const [suspiciousSegments, setSuspiciousSegments] = useState<SuspiciousSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processingTime, setProcessingTime] = useState<number>(0);

  const { logDetection, getTimingHelper } = useAuditLog();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!validateVideoFile(file)) {
      toast.error('Invalid file type. Please upload an MP4, WebM, or OGG video.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 100MB.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setFrameResults([]);
    setOverallResult(null);
    setSuspiciousSegments([]);

    // Load video to get duration
    try {
      const video = await loadVideo(file);
      setVideoDuration(video.duration);
      toast.success('Video loaded successfully');
    } catch (error) {
      console.error('Video load error:', error);
      toast.error('Failed to load video');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const analyzeVideo = async () => {
    if (!selectedFile || !videoRef.current || !canvasRef.current) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    const timer = getTimingHelper();

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Extract frames (sample every 0.5 seconds)
      const frameInterval = 0.5;
      const frames = await extractFrames(video, canvas, frameInterval);

      if (frames.length === 0) {
        toast.error('No frames could be extracted from video');
        setIsAnalyzing(false);
        return;
      }

      // Initialize detector
      const detector = getDeepfakeDetector();
      await detector.waitForInitialization();

      // Analyze frames
      const results: FrameResult[] = [];

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        // Draw frame to canvas
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(frame.imageData, 0, 0, canvas.width, canvas.height);

        // Detect
        const tensor = canvasToTensor(canvas);
        const result = await detector.detectFromImage(tensor);
        tensor.dispose();

        results.push({
          frameIndex: i,
          timestamp: frame.timestamp,
          result,
        });

        setAnalysisProgress(((i + 1) / frames.length) * 100);
      }

      setFrameResults(results);

      // Calculate overall result
      const avgConfidence =
        results.reduce((sum, r) => sum + r.result.confidence, 0) / results.length;
      const deepfakeCount = results.filter((r) => r.result.isDeepfake).length;
      const isDeepfake = deepfakeCount > results.length / 2;

      const allAnomalies = Array.from(
        new Set(results.flatMap((r) => r.result.anomalies))
      );

      const overall: DetectionResult = {
        isDeepfake,
        confidence: avgConfidence,
        scores: {
          temporal: calculateTemporalConsistency(results),
        },
        anomalies: allAnomalies,
      };

      setOverallResult(overall);

      // Find suspicious segments
      const segments = findSuspiciousSegments(results);
      setSuspiciousSegments(segments);

      const elapsed = timer.getElapsedMs();
      setProcessingTime(elapsed);

      // Log detection
      await logDetection({
        detection_type: 'video',
        media_type: selectedFile.type,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        detection_result: isDeepfake ? 'deepfake' : 'real',
        confidence_score: avgConfidence,
        processing_time_ms: elapsed,
        metadata: {
          duration_seconds: video.duration,
          frames_analyzed: results.length,
          deepfake_frames: deepfakeCount,
          suspicious_segments: segments.length,
          temporal_consistency: overall.scores.temporal,
          anomalies_detected: allAnomalies,
        },
      });

      toast.success('Video analysis complete');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Video analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateTemporalConsistency = (results: FrameResult[]): number => {
    if (results.length < 2) return 1;

    let consistencyScore = 0;
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1].result;
      const curr = results[i].result;

      // Check if classification changed
      if (prev.isDeepfake === curr.isDeepfake) {
        consistencyScore++;
      }

      // Penalize large confidence jumps
      const confidenceDiff = Math.abs(prev.confidence - curr.confidence);
      if (confidenceDiff < 0.3) {
        consistencyScore += 0.5;
      }
    }

    return consistencyScore / (results.length - 1) / 1.5;
  };

  const findSuspiciousSegments = (
    results: FrameResult[]
  ): SuspiciousSegment[] => {
    const segments: SuspiciousSegment[] = [];
    let segmentStart: number | null = null;
    let segmentFrames: FrameResult[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.result.isDeepfake && result.result.confidence > 0.6) {
        if (segmentStart === null) {
          segmentStart = result.timestamp;
        }
        segmentFrames.push(result);
      } else {
        if (segmentStart !== null && segmentFrames.length > 0) {
          const avgConf =
            segmentFrames.reduce((sum, f) => sum + f.result.confidence, 0) /
            segmentFrames.length;

          segments.push({
            startTime: segmentStart,
            endTime: segmentFrames[segmentFrames.length - 1].timestamp,
            avgConfidence: avgConf,
            frameCount: segmentFrames.length,
          });
        }

        segmentStart = null;
        segmentFrames = [];
      }
    }

    // Handle final segment
    if (segmentStart !== null && segmentFrames.length > 0) {
      const avgConf =
        segmentFrames.reduce((sum, f) => sum + f.result.confidence, 0) /
        segmentFrames.length;

      segments.push({
        startTime: segmentStart,
        endTime: segmentFrames[segmentFrames.length - 1].timestamp,
        avgConfidence: avgConf,
        frameCount: segmentFrames.length,
      });
    }

    return segments;
  };

  const seekToSegment = (segment: SuspiciousSegment) => {
    if (videoRef.current) {
      videoRef.current.currentTime = segment.startTime;
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
    }
  };

  const exportReport = () => {
    if (!overallResult || !selectedFile) return;

    const report = {
      filename: selectedFile.name,
      fileSize: formatFileSize(selectedFile.size),
      duration: formatDuration(videoDuration),
      analysisDate: new Date().toISOString(),
      result: overallResult.isDeepfake ? 'DEEPFAKE' : 'AUTHENTIC',
      confidence: (overallResult.confidence * 100).toFixed(2) + '%',
      processingTime: processingTime + 'ms',
      framesAnalyzed: frameResults.length,
      deepfakeFrames: frameResults.filter((f) => f.result.isDeepfake).length,
      suspiciousSegments: suspiciousSegments.map((s) => ({
        start: formatDuration(s.startTime),
        end: formatDuration(s.endTime),
        confidence: (s.avgConfidence * 100).toFixed(2) + '%',
        frameCount: s.frameCount,
      })),
      scores: overallResult.scores,
      anomalies: overallResult.anomalies,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_analysis_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Report exported');
  };

  const reset = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setSelectedFile(null);
    setVideoUrl(null);
    setVideoDuration(0);
    setFrameResults([]);
    setOverallResult(null);
    setSuspiciousSegments([]);
    setCurrentTime(0);
    setIsPlaying(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Video Upload</CardTitle>
          <CardDescription>
            Upload a video to analyze for deepfake manipulation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && handleFileSelect(e.target.files[0])
              }
            />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drop your video here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Supports MP4, WebM, OGG • Maximum 100MB
            </p>
          </div>

          {selectedFile && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <VideoIcon className="h-5 w-5" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)} •{' '}
                      {formatDuration(videoDuration)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={analyzeVideo}
                    disabled={isAnalyzing}
                    className="gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      'Analyze Video'
                    )}
                  </Button>
                  <Button onClick={reset} variant="outline">
                    Clear
                  </Button>
                </div>
              </div>

              {isAnalyzing && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Analysis Progress</span>
                    <span>{Math.round(analysisProgress)}%</span>
                  </div>
                  <Progress value={analysisProgress} className="h-2" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Player and Analysis */}
      {videoUrl && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Video Player</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full"
                    preload="metadata"
                  />
                  <canvas ref={canvasRef} className="hidden" width={224} height={224} />
                </div>

                {/* Controls */}
                <div className="space-y-3">
                  <Slider
                    value={[currentTime]}
                    max={videoDuration}
                    step={0.1}
                    onValueChange={handleSeek}
                    className="w-full"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button
                        onClick={togglePlayPause}
                        variant="outline"
                        size="icon"
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <span className="text-sm text-muted-foreground">
                      {formatDuration(currentTime)} / {formatDuration(videoDuration)}
                    </span>
                  </div>
                </div>

                {/* Timeline with suspicious segments */}
                {suspiciousSegments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Suspicious Segments</h4>
                    <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
                      {suspiciousSegments.map((segment, index) => {
                        const left = (segment.startTime / videoDuration) * 100;
                        const width =
                          ((segment.endTime - segment.startTime) / videoDuration) * 100;

                        return (
                          <div
                            key={index}
                            className="absolute h-full bg-red-500 hover:bg-red-600 cursor-pointer transition-colors"
                            style={{ left: `${left}%`, width: `${width}%` }}
                            onClick={() => seekToSegment(segment)}
                            title={`${formatDuration(segment.startTime)} - ${formatDuration(
                              segment.endTime
                            )}`}
                          />
                        );
                      })}
                      {/* Current time indicator */}
                      <div
                        className="absolute top-0 w-0.5 h-full bg-primary"
                        style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Analysis Results</CardTitle>
                {overallResult && (
                  <Button
                    onClick={exportReport}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {overallResult ? (
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    {overallResult.isDeepfake ? (
                      <>
                        <AlertCircle className="h-8 w-8 text-red-500" />
                        <Badge variant="destructive" className="text-base px-3 py-1">
                          DEEPFAKE
                        </Badge>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-8 w-8 text-green-500" />
                        <Badge className="text-base px-3 py-1">AUTHENTIC</Badge>
                      </>
                    )}
                  </div>

                  {/* Confidence */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Confidence</span>
                      <span className="font-medium">
                        {(overallResult.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={overallResult.confidence * 100} className="h-2" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Frames Analyzed</p>
                      <p className="font-medium">{frameResults.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Deepfake Frames</p>
                      <p className="font-medium">
                        {frameResults.filter((f) => f.result.isDeepfake).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Processing Time</p>
                      <p className="font-medium">{processingTime}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Suspicious Segments</p>
                      <p className="font-medium">{suspiciousSegments.length}</p>
                    </div>
                  </div>

                  {/* Temporal Consistency */}
                  {overallResult.scores.temporal !== undefined && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Temporal Consistency</span>
                        <span className="font-medium">
                          {(overallResult.scores.temporal * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        value={overallResult.scores.temporal * 100}
                        className="h-2"
                      />
                    </div>
                  )}

                  {/* Segments List */}
                  {suspiciousSegments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Suspicious Segments</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {suspiciousSegments.map((segment, index) => (
                          <button
                            key={index}
                            onClick={() => seekToSegment(segment)}
                            className="w-full p-2 text-left text-sm bg-muted hover:bg-muted/70 rounded transition-colors"
                          >
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {formatDuration(segment.startTime)} -{' '}
                                {formatDuration(segment.endTime)}
                              </span>
                              <span className="text-muted-foreground">
                                {(segment.avgConfidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Anomalies */}
                  {overallResult.anomalies.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Detected Anomalies</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {overallResult.anomalies.map((anomaly, index) => (
                          <li key={index}>• {anomaly.replace(/_/g, ' ')}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : isAnalyzing ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-muted-foreground">Analyzing video...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {Math.round(analysisProgress)}%
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Analyze the video to see results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default VideoAnalyzer;
