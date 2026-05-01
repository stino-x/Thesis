/**
 * Image Analyzer Component
 * 
 * Upload and analyze images for deepfake detection
 * Features:
 * - Drag and drop upload
 * - Image preview
 * - Detailed analysis results
 * - Export report capability
 */

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Image as ImageIcon, AlertCircle, CheckCircle, Download, RefreshCw, Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { UploadZone } from '@/components/ui/upload-zone';

import { loadImage, validateImageFile, formatFileSize } from '@/utils/videoUtils';
import { drawImageScaled, drawBoundingBox, drawLandmarks, drawConfidenceOverlay, createHeatmap } from '@/utils/canvasUtils';
import { waitForOpenCV, canvasToMat, preprocessForML, deleteMat } from '@/lib/opencv';
import { getFaceDetector, getFaceMesh } from '@/lib/mediapipe';
import { getDeepfakeDetector } from '@/lib/tensorflow';
import { performELA, type ELAResult } from '@/lib/forensics/elaAnalyzer';
import { detectFileWithUnivFD, type UnivFDResult } from '@/lib/api/univfdClient';
import { applyDefensiveTransforms } from '@/lib/defense/defensiveTransforms';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useSettings } from '@/hooks/useSettings';
import { ConfidenceWarning } from '@/components/ConfidenceWarning';
import { EnhancedResultsPanel } from '@/components/EnhancedResultsPanel';
import { enhanceDetectionResult, type EnhancedDetectionResult } from '@/lib/tensorflow/enhancedDetector';
import type { DetectionResult } from '@/lib/tensorflow/detector';

const ImageAnalyzer = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [enhancedResult, setEnhancedResult] = useState<EnhancedDetectionResult | null>(null);
  const [elaResult, setElaResult] = useState<ELAResult | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [univfdResult, setUnivfdResult] = useState<UnivFDResult | null>(null);

  const { logDetection, getTimingHelper } = useAuditLog();
  const { settings } = useSettings();

  const handleFileSelect = (file: File) => {
    if (!validateImageFile(file)) {
      toast.error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }

    // Revoke previous URL to prevent memory leak
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setSelectedFile(file);
    setImageUrl(URL.createObjectURL(file));
    setResult(null);
    setElaResult(null);
    setUnivfdResult(null);
    toast.success('Image loaded successfully');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const analyzeImage = async () => {
    if (!selectedFile || !canvasRef.current) return;

    setIsAnalyzing(true);
    const timer = getTimingHelper();

    // Import performance monitor
    const performanceMonitor = (await import('@/lib/performance/performanceMonitor')).default;
    performanceMonitor.startMark('image-analysis-total');

    try {
      const canvas = canvasRef.current;

      // 1. Load image + wait for OpenCV in parallel
      performanceMonitor.startMark('image-loading');
      const [img] = await Promise.all([
        loadImage(selectedFile),
        waitForOpenCV(30000), // Increase timeout to 30 seconds
      ]);
      drawImageScaled(canvas, img);
      setImageDimensions({ width: img.width, height: img.height });
      const loadingTime = performanceMonitor.endMark('image-loading');

      // 1.5. Apply defensive transforms if enabled
      let transformTime = 0;
      if (settings.enableDefensiveTransforms) {
        try {
          performanceMonitor.startMark('defensive-transforms');
          const transformedCanvas = await applyDefensiveTransforms(canvas, {
            jpegCompression: settings.jpegQuality,
            gaussianBlur: settings.gaussianBlur > 0 ? settings.gaussianBlur : undefined,
            randomCrop: settings.enableRandomCrop,
            resize: settings.enableResize,
          });
          // Copy transformed canvas back
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(transformedCanvas, 0, 0);
          }
          transformTime = performanceMonitor.endMark('defensive-transforms');
        } catch (transformError) {
          console.warn('⚠️  Defensive transforms failed, using original image:', transformError);
          toast.warning('Defensive transforms failed, proceeding with original image');
          // Continue with original canvas
        }
      }

      // 2. Preprocess with OpenCV
      const mat = canvasToMat(canvas);
      const processed = preprocessForML(mat, 224);

      // 3. Face Detection + UnivFD + ELA all in parallel (all independent)
      performanceMonitor.startMark('face-detection');
      const faceDetector = getFaceDetector();
      await faceDetector.waitForInitialization();

      const [faces, univfd, elaData] = await Promise.all([
        faceDetector.detect(canvas),
        detectFileWithUnivFD(selectedFile).catch(() => null),
        performELA(canvas).catch(() => null),
      ]);
      const faceDetectionTime = performanceMonitor.endMark('face-detection');

      if (univfd) setUnivfdResult(univfd);
      if (elaData) setElaResult(elaData);

      if (!faces[0]?.detected) {
        toast.warning('No face detected in image');
        setResult({
          isDeepfake: false,
          confidence: 0,
          scores: {},
          anomalies: ['no_face_detected'],
          modelsUsed: [],
        });
        deleteMat(mat);
        deleteMat(processed);
        setIsAnalyzing(false);
        performanceMonitor.endMark('image-analysis-total');
        return;
      }

      // 4. Face Mesh (needs face detection result first)
      const faceMesh = getFaceMesh();
      await faceMesh.waitForInitialization();
      const meshResult = await faceMesh.detect(canvas);

      // 5. Multi-Modal Detection
      performanceMonitor.startMark('model-inference');
      const detector = getDeepfakeDetector();
      await detector.waitForInitialization();
      detector.setThreshold(1 - settings.sensitivity);

      const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

      let detectionResult: DetectionResult;

      if (meshResult.detected && meshResult.landmarks) {
        const eyeLandmarks = faceMesh.getEyeLandmarks(meshResult.landmarks);
        const leftEAR = faceMesh.calculateEyeAspectRatio(eyeLandmarks.leftEye);
        const rightEAR = faceMesh.calculateEyeAspectRatio(eyeLandmarks.rightEye);

        detectionResult = await detector.detectMultiModal({
          imageData,
          features: {
            blinkRate: 0,
            eyeAspectRatio: (leftEAR + rightEAR) / 2,
            landmarkJitter: 0,
            faceSymmetry: 0.8,
            mouthMovement: 0,
            headPoseStability: 1,
          },
          faceMesh: meshResult.landmarks,
          canvas,
          faceBbox: faces[0].boundingBox ?? undefined,
          file: selectedFile,
          timestamp: performance.now(),
          univfd: univfd ?? undefined,
        });
      } else {
        detectionResult = await detector.detectMultiModal({
          imageData,
          canvas,
          faceBbox: faces[0].boundingBox ?? undefined,
          file: selectedFile,
          univfd: univfd ?? undefined,
        });
      }
      const inferenceTime = performanceMonitor.endMark('model-inference');

      // 6. Merge ELA anomalies into detection result
      if (elaData?.anomalies.length) {
        detectionResult.anomalies = Array.from(new Set([
          ...detectionResult.anomalies,
          ...elaData.anomalies,
        ]));
      }

      setResult(detectionResult);
      const elapsed = timer.getElapsedMs();
      setProcessingTime(elapsed);

      // 7. Enhance with research-grade features (if enabled)
      let calibrationTime = 0;
      let adversarialTime = 0;
      let partialDetectionTime = 0;

      if (settings.enableCalibration || settings.enableAdversarialDetection || settings.enablePartialDetection) {
        performanceMonitor.startMark('research-features');
        const imageDataForEnhancement = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        
        const enhanced = enhanceDetectionResult(
          detectionResult,
          imageDataForEnhancement,
          faces[0].boundingBox,
          meshResult.detected ? meshResult.landmarks : undefined
        );
        
        setEnhancedResult(enhanced);
        const researchTime = performanceMonitor.endMark('research-features');
        
        // Estimate individual times (rough approximation)
        if (settings.enableCalibration) calibrationTime = researchTime * 0.2;
        if (settings.enableAdversarialDetection) adversarialTime = researchTime * 0.3;
        if (settings.enablePartialDetection) partialDetectionTime = researchTime * 0.5;
      } else {
        setEnhancedResult(null);
      }

      // 8. Draw overlays
      performanceMonitor.startMark('overlay-drawing');
      drawOverlays(faces, meshResult, detectionResult, elaData);
      const overlayTime = performanceMonitor.endMark('overlay-drawing');

      const totalTime = performanceMonitor.endMark('image-analysis-total');

      // Record performance metrics
      performanceMonitor.recordEntry('image-detection', {
        detectionTime: inferenceTime,
        modelLoadingTime: loadingTime,
        faceDetectionTime: faceDetectionTime,
        calibrationTime,
        adversarialTime,
        partialDetectionTime,
        totalTime,
        memoryUsage: performanceMonitor.getMemoryUsage(),
      });

      console.log(`⏱️  Performance breakdown: Load=${loadingTime.toFixed(0)}ms, Transform=${transformTime.toFixed(0)}ms, Face=${faceDetectionTime.toFixed(0)}ms, Inference=${inferenceTime.toFixed(0)}ms, Overlay=${overlayTime.toFixed(0)}ms, Total=${totalTime.toFixed(0)}ms`);

      // 9. Log detection
      await logDetection({
        detection_type: 'image',
        media_type: selectedFile.type,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        detection_result: detectionResult.isDeepfake ? 'deepfake' : 'real',
        confidence_score: detectionResult.confidence,
        processing_time_ms: elapsed,
        metadata: {
          face_detected: faces[0].detected,
          resolution: `${img.width}x${img.height}`,
          multi_modal: true,
          modalities_used: [
            'visual',
            'metadata',
            'ela',
            ...(meshResult.detected ? ['ppg'] : []),
          ],
          scores: detectionResult.scores,
          anomalies_detected: detectionResult.anomalies,
          ela: elaData ? {
            score: elaData.score,
            suspiciousRegions: elaData.details.suspiciousRegionCount,
          } : undefined,
        },
      });

      // Cleanup
      deleteMat(mat);
      deleteMat(processed);

      toast.success('Analysis complete');
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Analysis failed: ${errorMessage}`);
      
      // Set a minimal result to show something went wrong
      setResult({
        isDeepfake: false,
        confidence: 0,
        scores: {},
        anomalies: ['analysis_error'],
        modelsUsed: [],
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const drawOverlays = useCallback((
    faces: Awaited<ReturnType<ReturnType<typeof getFaceDetector>['detect']>>,
    meshResult: Awaited<ReturnType<ReturnType<typeof getFaceMesh>['detect']>>,
    detectionResult: DetectionResult,
    elaData: ELAResult | null,
  ) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !imageDimensions) return;

    overlay.width = imageDimensions.width;
    overlay.height = imageDimensions.height;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const color = detectionResult.isDeepfake ? '#ff0000' : '#00ff00';

    // Bounding box
    if (settings.showBoundingBoxes && faces[0]?.boundingBox) {
      const bbox = faces[0].boundingBox;
      drawBoundingBox(ctx, {
        x: bbox.xMin * overlay.width,
        y: bbox.yMin * overlay.height,
        width: bbox.width * overlay.width,
        height: bbox.height * overlay.height,
      }, color, 3);
    }

    // Face mesh landmarks
    if (settings.showBoundingBoxes && meshResult.detected && meshResult.landmarks) {
      const scaledLandmarks = meshResult.landmarks.map((lm: { x: number; y: number }) => ({
        x: lm.x * overlay.width,
        y: lm.y * overlay.height,
      }));
      drawLandmarks(ctx, scaledLandmarks, color, 1);
    }

    // ELA Heatmap
    if (settings.showHeatmap && elaData?.details.suspiciousRegions) {
      createHeatmap(overlay, elaData.details.suspiciousRegions);
    }
    
    // Partial deepfake heatmap (if enabled and available)
    if (showHeatmap && enhancedResult?.partial?.heatmap) {
      ctx.putImageData(enhancedResult.partial.heatmap, 0, 0);
    }

    // Confidence badge
    if (settings.showConfidenceBadge) {
      drawConfidenceOverlay(ctx, detectionResult.confidence, detectionResult.isDeepfake, 10, 40);
    }
  }, [imageDimensions, settings, showHeatmap, enhancedResult]);

  const exportReport = () => {
    if (!result || !selectedFile) return;

    const report = {
      filename: selectedFile.name,
      fileSize: formatFileSize(selectedFile.size),
      analysisDate: new Date().toISOString(),
      result: result.isDeepfake ? 'DEEPFAKE' : 'AUTHENTIC',
      confidence: (result.confidence * 100).toFixed(2) + '%',
      processingTime: processingTime + 'ms',
      scores: result.scores,
      anomalies: result.anomalies,
      multiModalDetails: result.multiModalDetails,
      ela: elaResult ? {
        score: elaResult.score,
        meanError: elaResult.details.meanError,
        suspiciousRegions: elaResult.details.suspiciousRegionCount,
        noiseScore: elaResult.details.noiseScore,
        frequencyScore: elaResult.details.frequencyScore,
      } : undefined,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Report exported');
  };

  const reset = () => {
    setSelectedFile(null);
    setImageUrl(null);
    setResult(null);
    setElaResult(null);
    setUnivfdResult(null);
    setProcessingTime(0);
    setImageDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Upload Area */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Image Upload</CardTitle>
          </div>
          <CardDescription>
            Upload an image to analyze for deepfake manipulation
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          
          <UploadZone
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            title="Drop your image here or click to browse"
            description="Supports JPEG, PNG, WebP • Maximum 10MB"
          />

          {selectedFile && (
            <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-primary/20 animate-scale-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ImageIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                      {imageDimensions && ` • ${imageDimensions.width}×${imageDimensions.height}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    size="lg"
                    className="gap-2 shadow-lg hover:shadow-xl"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analyze Image
                      </>
                    )}
                  </Button>
                  <Button onClick={reset} variant="outline" size="lg" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>

              {isAnalyzing && (
                <div className="mt-4 space-y-3 animate-slide-up">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Analyzing image...
                    </span>
                    <span className="text-muted-foreground">Please wait</span>
                  </div>
                  <Progress value={100} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Running multi-modal detection with 5+ ML models
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview and Results */}
      {imageUrl && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Image Preview */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <CardTitle>Image Preview</CardTitle>
                </div>
                {result && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOverlays(!showOverlays)}
                    className="gap-2 hover:bg-primary/10"
                  >
                    {showOverlays ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showOverlays ? 'Hide' : 'Show'} Overlays
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                {showOverlays && (
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>Analysis Results</CardTitle>
                </div>
                {result && (
                  <Button
                    onClick={exportReport}
                    variant="outline"
                    size="sm"
                    className="gap-2 hover:bg-primary/10"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {result ? (
                <div className="space-y-6 animate-scale-in">
                  {/* Status Badge - Enhanced */}
                  <div className={`p-6 rounded-lg border-2 ${
                    result.isDeepfake 
                      ? 'bg-red-500/10 border-red-500/50 shadow-lg shadow-red-500/20' 
                      : 'bg-green-500/10 border-green-500/50 shadow-lg shadow-green-500/20'
                  } transition-all duration-300`}>
                    <div className="flex items-center gap-4">
                      {result.isDeepfake ? (
                        <>
                          <div className="p-3 rounded-full bg-red-500/20 animate-pulse-glow">
                            <AlertCircle className="h-8 w-8 text-red-500" />
                          </div>
                          <div className="flex-1">
                            <Badge variant="destructive" className="text-base px-4 py-1.5 shadow-lg">
                              ⚠️ DEEPFAKE DETECTED
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-2">
                              This image shows signs of manipulation
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3 rounded-full bg-green-500/20">
                            <CheckCircle className="h-8 w-8 text-green-500" />
                          </div>
                          <div className="flex-1">
                            <Badge className="text-base px-4 py-1.5 bg-green-500 hover:bg-green-600 shadow-lg">
                              ✓ AUTHENTIC
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-2">
                              No signs of manipulation detected
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Confidence - Enhanced */}
                  <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Confidence Score</span>
                      <span className="text-2xl font-bold text-primary">
                        {(result.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={result.confidence * 100}
                      className="h-3"
                    />
                    <p className="text-xs text-muted-foreground">
                      Based on analysis from {result.modelsUsed?.length || 5}+ ML models
                    </p>
                  </div>

                  {/* Processing Time - Enhanced */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="text-sm text-muted-foreground">Processing Time</span>
                    <span className="text-sm font-medium">{processingTime}ms</span>
                  </div>

                  {/* Score Breakdown - Enhanced */}
                  {result.scores && Object.keys(result.scores).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-primary" />
                        Score Breakdown
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(result.scores).map(([key, value]) => (
                          value !== undefined && (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize text-muted-foreground">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                                <span className="font-medium">{(value * 100).toFixed(1)}%</span>
                              </div>
                              <Progress value={value * 100} className="h-1.5" />
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Anomalies - Enhanced */}
                  {result.anomalies.length > 0 && (
                    <div className="space-y-3 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <h4 className="font-semibold text-sm flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <AlertCircle className="h-4 w-4" />
                        Detected Anomalies
                      </h4>
                      <ul className="space-y-2">
                        {result.anomalies.map((anomaly, index) => (
                          <li key={index} className="text-sm flex items-start gap-2">
                            <span className="text-orange-500 mt-0.5">•</span>
                            <span className="text-muted-foreground capitalize">
                              {anomaly.replace(/_/g, ' ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Multi-Modal Forensic Details */}
                  <Accordion type="single" collapsible className="w-full">
                    {result.multiModalDetails?.metadata && (
                      <AccordionItem value="metadata">
                        <AccordionTrigger className="text-sm font-medium">Metadata Forensics</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            {result.multiModalDetails.metadata.details.fileInfo && (
                              <div>
                                <p><strong>File:</strong> {result.multiModalDetails.metadata.details.fileInfo.name}</p>
                                <p><strong>Type:</strong> {result.multiModalDetails.metadata.details.fileInfo.type}</p>
                                <p><strong>Size:</strong> {formatFileSize(result.multiModalDetails.metadata.details.fileInfo.size)}</p>
                              </div>
                            )}
                            {result.multiModalDetails.metadata.details.suspiciousPatterns.length > 0 && (
                              <div>
                                <p className="font-medium text-foreground">Suspicious Patterns:</p>
                                <ul className="space-y-1 mt-1">
                                  {result.multiModalDetails.metadata.details.suspiciousPatterns.map((p, i) => (
                                    <li key={i} className="text-orange-500">⚠ {p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {result.multiModalDetails.metadata.details.suspiciousPatterns.length === 0 && (
                              <p className="text-green-500">✓ No suspicious metadata patterns detected</p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {result.multiModalDetails?.ppg && (
                      <AccordionItem value="ppg">
                        <AccordionTrigger className="text-sm font-medium">Physiological (PPG)</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p><strong>PPG Score:</strong> {(result.multiModalDetails.ppg.score * 100).toFixed(1)}%</p>
                            <p><strong>Confidence:</strong> {(result.multiModalDetails.ppg.confidence * 100).toFixed(1)}%</p>
                            {result.multiModalDetails.ppg.anomalies.length > 0 && (
                              <ul className="space-y-1 mt-1">
                                {result.multiModalDetails.ppg.anomalies.map((a, i) => (
                                  <li key={i} className="text-orange-500">⚠ {a.replace(/_/g, ' ')}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {result.multiModalDetails?.lipSync && (
                      <AccordionItem value="lipsync">
                        <AccordionTrigger className="text-sm font-medium">Lip-Sync Analysis</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p><strong>Sync Score:</strong> {(result.multiModalDetails.lipSync.score * 100).toFixed(1)}%</p>
                            <p><strong>Confidence:</strong> {(result.multiModalDetails.lipSync.confidence * 100).toFixed(1)}%</p>
                            {result.multiModalDetails.lipSync.anomalies.length > 0 && (
                              <ul className="space-y-1 mt-1">
                                {result.multiModalDetails.lipSync.anomalies.map((a, i) => (
                                  <li key={i} className="text-orange-500">⚠ {a.replace(/_/g, ' ')}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {result.multiModalDetails?.voice && (
                      <AccordionItem value="voice">
                        <AccordionTrigger className="text-sm font-medium">Voice Analysis</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p><strong>Voice Score:</strong> {(result.multiModalDetails.voice.score * 100).toFixed(1)}%</p>
                            <p><strong>Confidence:</strong> {(result.multiModalDetails.voice.confidence * 100).toFixed(1)}%</p>
                            {result.multiModalDetails.voice.anomalies.length > 0 && (
                              <ul className="space-y-1 mt-1">
                                {result.multiModalDetails.voice.anomalies.map((a, i) => (
                                  <li key={i} className="text-orange-500">⚠ {a.replace(/_/g, ' ')}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {elaResult && (
                      <AccordionItem value="ela">
                        <AccordionTrigger className="text-sm font-medium">Error Level Analysis (ELA)</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p><strong>ELA Score:</strong> {(elaResult.score * 100).toFixed(1)}%</p>
                            <p><strong>Mean Error:</strong> {elaResult.details.meanError.toFixed(2)}</p>
                            <p><strong>Noise Consistency:</strong> {(elaResult.details.noiseScore * 100).toFixed(1)}%</p>
                            <p><strong>Frequency Score:</strong> {(elaResult.details.frequencyScore * 100).toFixed(1)}%</p>
                            <p><strong>Suspicious Regions:</strong> {elaResult.details.suspiciousRegionCount}</p>
                            {elaResult.anomalies.length > 0 && (
                              <ul className="space-y-1 mt-1">
                                {elaResult.anomalies.map((a, i) => (
                                  <li key={i} className="text-orange-500">⚠ {a.replace(/_/g, ' ')}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                    {univfdResult && univfdResult.available && (
                      <AccordionItem value="univfd">
                        <AccordionTrigger className="text-sm font-medium">
                          CLIP / UnivFD Analysis {!univfdResult.modelLoaded && '(zero-shot)'}
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p><strong>Method:</strong> {univfdResult.method === 'univfd' ? 'UnivFD linear probe' : 'CLIP zero-shot'}</p>
                            <p><strong>Fake Score:</strong> {(univfdResult.score * 100).toFixed(1)}%</p>
                            <p><strong>Confidence:</strong> {(univfdResult.confidence * 100).toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Detects: Stable Diffusion, DALL-E, Midjourney, SORA
                            </p>
                            {univfdResult.anomalies.length > 0 && (
                              <ul className="space-y-1 mt-1">
                                {univfdResult.anomalies.map((a, i) => (
                                  <li key={i} className="text-orange-500">⚠ {a.replace(/_/g, ' ')}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>

                  {/* Confidence & Adversarial Warnings */}
                  <ConfidenceWarning
                    confidence={result.confidence}
                    isDeepfake={result.isDeepfake}
                    modelsUsed={result.modelsUsed || []}
                  />

                  {/* Enhanced Research-Grade Results */}
                  {enhancedResult && (settings.enableCalibration || settings.enableAdversarialDetection || settings.enablePartialDetection) && (
                    <div className="pt-4 border-t">
                      <EnhancedResultsPanel
                        result={enhancedResult}
                        showHeatmap={showHeatmap}
                        onHeatmapToggle={() => setShowHeatmap(!showHeatmap)}
                      />
                    </div>
                  )}
                </div>
              ) : isAnalyzing ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-muted-foreground">Analyzing image...</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Upload and analyze an image to see results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ImageAnalyzer;
