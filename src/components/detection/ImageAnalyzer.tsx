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

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Image as ImageIcon, AlertCircle, CheckCircle, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { loadImage, validateImageFile, formatFileSize } from '@/utils/videoUtils';
import { drawImageScaled } from '@/utils/canvasUtils';
import { waitForOpenCV, canvasToMat, preprocessForML, deleteMat } from '@/lib/opencv';
import { getFaceDetector, getFaceMesh } from '@/lib/mediapipe';
import { getDeepfakeDetector, canvasToTensor } from '@/lib/tensorflow';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { DetectionResult } from '@/lib/tensorflow/detector';

const ImageAnalyzer = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);

  const { logDetection, getTimingHelper } = useAuditLog();

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

      setResult(detectionResult);
      const elapsed = timer.getElapsedMs();
      setProcessingTime(elapsed);

      // 7. Log detection
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
            ...(meshResult.detected ? ['ppg'] : []),
          ],
          scores: detectionResult.scores,
          anomalies_detected: detectionResult.anomalies,
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
    setProcessingTime(0);
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
              <CardTitle>Image Preview</CardTitle>
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
