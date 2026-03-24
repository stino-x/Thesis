/**
 * Diagnostic Panel Component
 * 
 * Shows real-time status of all detection components
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

import { getFaceDetector } from '@/lib/mediapipe';
import { getDeepfakeDetector } from '@/lib/tensorflow';
import * as tf from '@tensorflow/tfjs';

interface ComponentStatus {
  name: string;
  status: 'loading' | 'ready' | 'error';
  details?: string;
  error?: string;
}

const DiagnosticPanel = () => {
  const [statuses, setStatuses] = useState<ComponentStatus[]>([
    { name: 'TensorFlow.js', status: 'loading' },
    { name: 'Face Detection', status: 'loading' },
    { name: 'MesoNet Model', status: 'loading' },
    { name: 'Webcam Access', status: 'loading' },
  ]);

  const checkStatus = async () => {
    const newStatuses: ComponentStatus[] = [];

    // 1. Check TensorFlow.js
    try {
      await tf.ready();
      newStatuses.push({
        name: 'TensorFlow.js',
        status: 'ready',
        details: `Backend: ${tf.getBackend()}, Version: ${tf.version.tfjs}`,
      });
    } catch (error) {
      newStatuses.push({
        name: 'TensorFlow.js',
        status: 'error',
        error: error.message,
      });
    }

    // 2. Check Face Detection
    try {
      const faceDetector = getFaceDetector();
      await faceDetector.waitForInitialization();
      newStatuses.push({
        name: 'Face Detection',
        status: 'ready',
        details: 'MediaPipe Face Detection initialized',
      });
    } catch (error) {
      newStatuses.push({
        name: 'Face Detection',
        status: 'error',
        error: error.message,
      });
    }

    // 3. Check MesoNet Model
    try {
      const detector = getDeepfakeDetector();
      await detector.waitForInitialization();
      
      // Try to load the model directly to get more info
      const model = await tf.loadLayersModel('/models/mesonet/model.json');
      newStatuses.push({
        name: 'MesoNet Model',
        status: 'ready',
        details: `Input: ${JSON.stringify(model.inputs[0].shape)}, Output: ${JSON.stringify(model.outputs[0].shape)}`,
      });
      model.dispose();
    } catch (error) {
      newStatuses.push({
        name: 'MesoNet Model',
        status: 'error',
        error: error.message,
      });
    }

    // 4. Check Webcam Access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately
      newStatuses.push({
        name: 'Webcam Access',
        status: 'ready',
        details: 'Camera permissions granted',
      });
    } catch (error) {
      newStatuses.push({
        name: 'Webcam Access',
        status: 'error',
        error: error.message,
      });
    }

    setStatuses(newStatuses);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const getStatusIcon = (status: ComponentStatus['status']) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'loading':
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: ComponentStatus['status']) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-500">Ready</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'loading':
        return <Badge variant="secondary">Loading</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          System Diagnostics
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            className="ml-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Real-time status of all detection components
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {statuses.map((status, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(status.status)}
                <div>
                  <div className="font-medium">{status.name}</div>
                  {status.details && (
                    <div className="text-sm text-muted-foreground">{status.details}</div>
                  )}
                  {status.error && (
                    <div className="text-sm text-red-500">{status.error}</div>
                  )}
                </div>
              </div>
              {getStatusBadge(status.status)}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 pt-4 border-t">
          <h4 className="font-medium mb-3">Quick Actions</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/test-model.html', '_blank')}
            >
              Test Model Loading
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log('TensorFlow backend:', tf.getBackend())}
            >
              Log TF Backend
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DiagnosticPanel;