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
import { Upload, Image as ImageIcon, AlertCircle, CheckCircle, Download, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { loadImage, validateImageFile, formatFileSize } from '@/utils/videoUtils';
import { drawImageScaled, drawBoundingBox, drawLandmarks, drawConfidenceOverlay, createHeatmap } from '@/utils/canvasUtils';
import { waitForOpenCV, canvasToMat, preprocessForML, deleteMat } from '@/lib/opencv';
import { getFaceDetector, getFaceMesh } from '@/lib/mediapipe';
import { getDeepfakeDetector, canvasToTensor } from '@/lib/tensorflow';
import { performELA, type ELAResult } from '@/lib/forensics/elaAnalyzer';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useSettings } from '@/hooks/useSettings';
import type { DetectionResult } from '@/lib/tensorflow/detector';

const ImageAnalyzer = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [elaResult, setElaResult] = useState<ELAResult | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [showOverlays, setShowOverlays] = useState(true);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

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

    setSelectedFile(file);
    setImageUrl(URL.createObjectURL(file));
    setResult(null);
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

    try {
      const canvas = canvasRef.current;

      // 1. Load image
      const img = await loadImage(selectedFile);
      drawImageScaled(canvas, img);
      setImageDimensions({ width: img.width, height: img.height });

      // 2. Wait for OpenCV
      await waitForOpenCV();

      // 3. Preprocess with OpenCV
      const mat = canvasToMat(canvas);
      const processed = preprocessForML(mat, 224);

      // 4. Face Detection
      const faceDetector = getFaceDetector();
      await faceDetector.waitForInitialization();
      const faces = await faceDetector.detect(canvas);

      if (!faces[0]?.detected) {
        toast.warning('No face detected in image');
        setResult({
          isDeepfake: false,
          confidence: 0,
          scores: {},
          anomalies: ['no_face_detected'],
        });
        deleteMat(mat);
        deleteMat(processed);
        setIsAnalyzing(false);
        return;
      }

      // 5. Face Mesh
      const faceMesh = getFaceMesh();
      await faceMesh.waitForInitialization();
      const meshResult = await faceMesh.detect(canvas);

      // 6. Multi-Modal Detection
      const detector = getDeepfakeDetector();
      await detector.waitForInitialization();
      detector.setThreshold(1 - settings.sensitivity);

      // Prepare image data
      const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

      let detectionResult: DetectionResult;

      if (meshResult.detected && meshResult.landmarks) {
        // Full multi-modal analysis with face mesh
        const eyeLandmarks = faceMesh.getEyeLandmarks(meshResult.landmarks);
        const leftEAR = faceMesh.calculateEyeAspectRatio(eyeLandmarks.leftEye);
        const rightEAR = faceMesh.calculateEyeAspectRatio(eyeLandmarks.rightEye);

        const features = {
          blinkRate: 0, // Can't measure from single image
          eyeAspectRatio: (leftEAR + rightEAR) / 2,
          landmarkJitter: 0,
          faceSymmetry: 0.8,
          mouthMovement: 0,
          headPoseStability: 1,
        };

        // Multi-modal detection with metadata + visual + PPG
        detectionResult = await detector.detectMultiModal({
          imageData,
          features,
          faceMesh: meshResult.landmarks,
          canvas,
          file: selectedFile,
          timestamp: performance.now(),
        });
      } else {
        // Fallback to visual + metadata only
        detectionResult = await detector.detectMultiModal({
          imageData,
          file: selectedFile,
        });
      }

      // 7. Run ELA forensic analysis
      let elaData: ELAResult | null = null;
      try {
        elaData = await performELA(canvas);
        setElaResult(elaData);
        // Merge ELA anomalies into detection result
        if (elaData.anomalies.length > 0) {
          detectionResult.anomalies = Array.from(new Set([
            ...detectionResult.anomalies,
            ...elaData.anomalies,
          ]));
        }
      } catch (elaError) {
        console.warn('ELA analysis failed:', elaError);
      }

      setResult(detectionResult);
      const elapsed = timer.getElapsedMs();
      setProcessingTime(elapsed);

      // 8. Draw overlays on visible overlay canvas
      drawOverlays(faces, meshResult, detectionResult, elaData);

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
      toast.error('Analysis failed. Please try again.');
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

    // Heatmap
    if (settings.showHeatmap && elaData?.details.suspiciousRegions) {
      createHeatmap(overlay, elaData.details.suspiciousRegions);
    }

    // Confidence badge
    if (settings.showConfidenceBadge) {
      drawConfidenceOverlay(ctx, detectionResult.confidence, detectionResult.isDeepfake, 10, 40);
    }
  }, [imageDimensions, settings]);

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
    setProcessingTime(0);
    setImageDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Image Upload</CardTitle>
          <CardDescription>
            Upload an image to analyze for deepfake manipulation
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
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drop your image here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Supports JPEG, PNG, WebP • Maximum 10MB
            </p>
          </div>

          {selectedFile && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-5 w-5" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      'Analyze Image'
                    )}
                  </Button>
                  <Button onClick={reset} variant="outline">
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview and Results */}
      {imageUrl && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Image Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Image Preview</CardTitle>
                {result && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOverlays(!showOverlays)}
                    className="gap-2"
                  >
                    {showOverlays ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showOverlays ? 'Hide' : 'Show'} Overlays
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Analysis Results</CardTitle>
                {result && (
                  <Button
                    onClick={exportReport}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export Report
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    {result.isDeepfake ? (
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

                  {/* Confidence */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Confidence</span>
                      <span className="font-medium">
                        {(result.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={result.confidence * 100}
                      className="h-2"
                    />
                  </div>

                  {/* Processing Time */}
                  <div className="text-sm text-muted-foreground">
                    Processing time: {processingTime}ms
                  </div>

                  {/* Score Breakdown */}
                  {result.scores && Object.keys(result.scores).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Score Breakdown</h4>
                      {Object.entries(result.scores).map(([key, value]) => (
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
                  {result.anomalies.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Detected Anomalies</h4>
                      <ul className="space-y-1">
                        {result.anomalies.map((anomaly, index) => (
                          <li key={index} className="text-sm text-muted-foreground">
                            • {anomaly.replace(/_/g, ' ')}
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
                  </Accordion>
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
