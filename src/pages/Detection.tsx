/**
 * Detection Page
 * 
 * Main page for deepfake detection with tabbed interface
 * Integrates webcam, image, and video analyzers
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Image, Video, Shield, Info } from 'lucide-react';

import WebcamDetector from '@/components/detection/WebcamDetector';
import ImageAnalyzer from '@/components/detection/ImageAnalyzer';
import VideoAnalyzer from '@/components/detection/VideoAnalyzer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Detection = () => {
  const [activeTab, setActiveTab] = useState<string>('webcam');

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
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
            Our detection system uses advanced AI models (MediaPipe, TensorFlow, OpenCV) to analyze
            facial features, texture patterns, and temporal consistency. Results are logged for
            transparency and can be exported for verification purposes.
          </AlertDescription>
        </Alert>
      </div>

      {/* Detection Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
              <WebcamDetector />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Image Analysis */}
        <TabsContent value="image" className="space-y-6">
          <ImageAnalyzer />
        </TabsContent>

        {/* Video Analysis */}
        <TabsContent value="video" className="space-y-6">
          <VideoAnalyzer />
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
                  <span className="font-medium text-foreground">MediaPipe Face Detection:</span> Locates
                  faces in the frame with bounding boxes and confidence scores
                </div>
                <div>
                  <span className="font-medium text-foreground">MediaPipe Face Mesh:</span> Extracts 468
                  facial landmarks for detailed feature analysis
                </div>
                <div>
                  <span className="font-medium text-foreground">TensorFlow.js:</span> Classifies images
                  and analyzes extracted features for deepfake patterns
                </div>
                <div>
                  <span className="font-medium text-foreground">OpenCV.js:</span> Preprocesses images
                  with noise reduction and histogram equalization
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Analyzed Features</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Blink Patterns:</span> Unnatural or
                  absent blinking can indicate synthetic faces
                </div>
                <div>
                  <span className="font-medium text-foreground">Landmark Stability:</span> Excessive
                  jitter in facial landmarks suggests manipulation
                </div>
                <div>
                  <span className="font-medium text-foreground">Face Symmetry:</span> Abnormal asymmetry
                  can reveal deepfake artifacts
                </div>
                <div>
                  <span className="font-medium text-foreground">Temporal Consistency:</span> Inconsistent
                  classification across video frames indicates manipulation
                </div>
                <div>
                  <span className="font-medium text-foreground">Texture Analysis:</span> AI-generated
                  faces often have distinctive texture patterns
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Detection;
