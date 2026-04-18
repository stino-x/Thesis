/**
 * Detection Page
 * 
 * Main page for deepfake detection with tabbed interface
 * Integrates webcam, image, and video analyzers
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Image, Video, Shield, Info, CheckCircle, Download, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { Header } from '@/components/Header';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { SettingsModal } from '@/components/SettingsModal';
import { AboutModal } from '@/components/AboutModal';
import DiagnosticPanel from '@/components/DiagnosticPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ModelLoadingStatus, getModelStatuses, subscribeModelStatuses, type ModelStatus } from '@/components/ModelLoadingStatus';
import { DetectionErrorBoundary } from '@/components/DetectionErrorBoundary';

// Lazy-load heavy detection components — TF.js + ONNX Runtime only load
// when the user actually navigates to /detection, not on the home page.
const WebcamDetector = lazy(() => import('@/components/detection/WebcamDetector'));
const ImageAnalyzer  = lazy(() => import('@/components/detection/ImageAnalyzer'));
const VideoAnalyzer  = lazy(() => import('@/components/detection/VideoAnalyzer'));

const DetectorFallback = () => (
  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
    Loading detection engine...
  </div>
);

/** Inline live model status strip shown in the capabilities card */
const LiveModelStatus = () => {
  const [statuses, setStatuses] = useState<ModelStatus[]>(getModelStatuses());

  useEffect(() => {
    return subscribeModelStatuses(setStatuses);
  }, []);

  const stateIcon = (state: ModelStatus['state']) => {
    if (state === 'ready' || state === 'cached') return <CheckCircle className="h-3 w-3 text-green-500" />;
    if (state === 'downloading') return <Download className="h-3 w-3 text-primary animate-pulse" />;
    if (state === 'error') return <XCircle className="h-3 w-3 text-red-500" />;
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };

  const stateBadge = (state: ModelStatus['state']) => {
    if (state === 'ready') return <Badge className="text-[10px] px-1 py-0 bg-green-500">ready</Badge>;
    if (state === 'cached') return <Badge className="text-[10px] px-1 py-0 bg-blue-500">cached</Badge>;
    if (state === 'downloading') return <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary">downloading</Badge>;
    if (state === 'error') return <Badge variant="destructive" className="text-[10px] px-1 py-0">error</Badge>;
    return <Badge variant="secondary" className="text-[10px] px-1 py-0">pending</Badge>;
  };

  return (
    <div className="mt-6 pt-4 border-t">
      <p className="text-xs font-medium text-muted-foreground mb-3">Live Model Status</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {statuses.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50">
            {stateIcon(s.state)}
            <span className="truncate flex-1">{s.label}</span>
            {stateBadge(s.state)}
          </div>
        ))}
      </div>
    </div>
  );
};

const Detection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'webcam';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onAboutClick={() => setAboutOpen(true)}
      />

      <main className="flex-1 container mx-auto py-8 px-4 max-w-7xl relative z-10">
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 shadow-lg">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Deepfake Detection
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyze media content for AI-generated or manipulated faces
            </p>
          </div>
        </div>

        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle>How it works</AlertTitle>
          <AlertDescription>
            Our detection system runs an ensemble of 5+ ML models simultaneously — ViT-based ONNX models
            (98.8% accuracy), SwinV2 AI-generation detector, MesoNet4, and a CLIP/UnivFD backend that
            generalizes to unseen generators. Layered on top: temporal consistency analysis, phoneme-based
            lip-sync, PPG blood-flow, voice artifact detection, ELA forensics, and metadata analysis.
            Results are logged for transparency and can be exported for verification.
          </AlertDescription>
        </Alert>
      </div>

      {/* Detection Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid h-12 p-1 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="webcam" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Webcam</span>
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Image</span>
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Video</span>
          </TabsTrigger>
        </TabsList>

        {/* Webcam Detection */}
        <TabsContent value="webcam" className="space-y-6 animate-slide-up">
          <ModelLoadingStatus />
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                <CardTitle>Real-time Webcam Detection</CardTitle>
              </div>
              <CardDescription>
                Analyze live video feed from your webcam for deepfake manipulation
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <DetectionErrorBoundary label="Webcam detection">
                <Suspense fallback={<DetectorFallback />}>
                  <WebcamDetector />
                </Suspense>
              </DetectionErrorBoundary>
            </CardContent>
          </Card>
          <DiagnosticPanel />
        </TabsContent>

        {/* Image Analysis */}
        <TabsContent value="image" className="space-y-6 animate-slide-up">
          <ModelLoadingStatus />
          <DetectionErrorBoundary label="Image analysis">
            <Suspense fallback={<DetectorFallback />}>
              <ImageAnalyzer />
            </Suspense>
          </DetectionErrorBoundary>
        </TabsContent>

        {/* Video Analysis */}
        <TabsContent value="video" className="space-y-6 animate-slide-up">
          <ModelLoadingStatus />
          <DetectionErrorBoundary label="Video analysis">
            <Suspense fallback={<DetectorFallback />}>
              <VideoAnalyzer />
            </Suspense>
          </DetectionErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Info Section */}
      <Card className="mt-8 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Detection Capabilities</CardTitle>
          </div>
          <CardDescription>
            Advanced features for comprehensive deepfake detection
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 hover:shadow-lg transition-all">
              <h3 className="font-semibold flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                Webcam Analysis
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>ViT-Deepfake-Exp (98.8% accuracy) via ONNX</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>SwinV2 AI-generation detector (98.1%)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>PPG blood-flow physiological signal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>468-point MediaPipe face mesh</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Continuous monitoring with FPS tracking</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 hover:shadow-lg transition-all">
              <h3 className="font-semibold flex items-center gap-2">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Image className="h-5 w-5 text-accent" />
                </div>
                Image Analysis
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>ViT-Deepfake-Exp + ViT-v2 + MesoNet4</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>CLIP/UnivFD backend (unseen generators)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>Error Level Analysis (ELA) forensics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>Metadata anomaly detection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>Drag & drop with detailed report export</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-blue-500/20 hover:shadow-lg transition-all">
              <h3 className="font-semibold flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Video className="h-5 w-5 text-blue-500" />
                </div>
                Video Analysis
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Batched frame analysis (4 frames parallel)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Temporal consistency (8-frame window)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Phoneme-based lip-sync detection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Voice artifact analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Suspicious segment timeline</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Live model status */}
          <LiveModelStatus />
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card className="mt-8 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle>Technical Details</CardTitle>
          </div>
          <CardDescription>
            The technology powering our detection system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold">Detection Models</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">ViT-Deepfake-Exp / ViT-v2 (ONNX):</span> Primary
                  detection engine — Vision Transformers trained on face-swap and reenactment datasets.
                  98.8% and 92.1% accuracy respectively. Run via ONNX Runtime Web (WASM).
                </div>
                <div>
                  <span className="font-medium text-foreground">SwinV2-AI-Detector (ONNX):</span> Detects
                  AI-generated content from Stable Diffusion, DALL-E, Midjourney, and Firefly. 98.1% accuracy.
                </div>
                <div>
                  <span className="font-medium text-foreground">CLIP / UnivFD (backend):</span> CLIP ViT-L/14
                  + linear probe — the only open-source approach that generalizes to unseen generators.
                  Runs on Modal.com serverless.
                </div>
                <div>
                  <span className="font-medium text-foreground">MesoNet4 (TensorFlow.js):</span> Lightweight
                  classic face-swap detector. Loads locally from /models/mesonet/.
                </div>
                <div>
                  <span className="font-medium text-foreground">MediaPipe:</span> Face detection and 468-point
                  face mesh for landmark extraction and face cropping before ViT inference.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Forensic Signals</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Temporal Consistency:</span> 8-frame sliding
                  window tracking score variance, verdict flip rate, and outlier frames — catches flickering
                  artifacts that single-frame models miss.
                </div>
                <div>
                  <span className="font-medium text-foreground">PPG Blood-Flow:</span> Detects absence of
                  heartbeat signal in facial skin pixels (Intel FakeCatcher approach). Video and webcam only.
                </div>
                <div>
                  <span className="font-medium text-foreground">Lip-Sync (Phoneme):</span> Correlates lip
                  movement onsets with phoneme boundaries via spectral flux and zero-crossing rate — catches
                  dubbed content that RMS-only approaches miss.
                </div>
                <div>
                  <span className="font-medium text-foreground">ELA Forensics:</span> Error Level Analysis
                  detects compression inconsistencies from image manipulation.
                </div>
                <div>
                  <span className="font-medium text-foreground">Metadata Forensics:</span> Checks file
                  timestamps, AI-common resolutions (512×512, 1024×1024), and codec mismatches.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </main>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
};

export default Detection;
