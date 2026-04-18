/**
 * Detection Page
 * 
 * Main page for deepfake detection with tabbed interface
 * Integrates webcam, image, and video analyzers
 */

import { useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Image, Video, Shield, Info } from 'lucide-react';

import { Header } from '@/components/Header';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { SettingsModal } from '@/components/SettingsModal';
import { AboutModal } from '@/components/AboutModal';
import DiagnosticPanel from '@/components/DiagnosticPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Deepfake Detection</h1>
            <p className="text-muted-foreground mt-1">
              Analyze media content for AI-generated or manipulated faces
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
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
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="webcam" className="gap-2">
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Webcam</span>
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Image</span>
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Video</span>
          </TabsTrigger>
        </TabsList>

        {/* Webcam Detection */}
        <TabsContent value="webcam" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Webcam Detection</CardTitle>
              <CardDescription>
                Analyze live video feed from your webcam for deepfake manipulation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<DetectorFallback />}>
                <WebcamDetector />
              </Suspense>
            </CardContent>
          </Card>
          <DiagnosticPanel />
        </TabsContent>

        {/* Image Analysis */}
        <TabsContent value="image" className="space-y-6">
          <Suspense fallback={<DetectorFallback />}>
            <ImageAnalyzer />
          </Suspense>
        </TabsContent>

        {/* Video Analysis */}
        <TabsContent value="video" className="space-y-6">
          <Suspense fallback={<DetectorFallback />}>
            <VideoAnalyzer />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Info Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Detection Capabilities</CardTitle>
          <CardDescription>
            Advanced features for comprehensive deepfake detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Webcam Analysis
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Real-time face detection</li>
                <li>• Continuous monitoring mode</li>
                <li>• Live overlay visualization</li>
                <li>• Snapshot capture with logging</li>
                <li>• FPS performance tracking</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                Image Analysis
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Drag & drop upload</li>
                <li>• Facial landmark detection</li>
                <li>• Texture analysis</li>
                <li>• Feature symmetry checks</li>
                <li>• Detailed report export</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Video Analysis
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Frame-by-frame analysis</li>
                <li>• Temporal consistency checks</li>
                <li>• Suspicious segment detection</li>
                <li>• Interactive timeline</li>
                <li>• Comprehensive report</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Technical Details</CardTitle>
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
