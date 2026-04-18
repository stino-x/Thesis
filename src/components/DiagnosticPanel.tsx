/**
 * Diagnostic Panel Component
 * 
 * Shows real-time status of all detection components
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, RefreshCw, Database } from 'lucide-react';

import { getFaceDetector } from '@/lib/mediapipe';
import { getDeepfakeDetector } from '@/lib/tensorflow';
import { getModelStatuses } from '@/components/ModelLoadingStatus';
import { PerformancePanel } from '@/components/PerformancePanel';
import * as tf from '@tensorflow/tfjs';

interface ComponentStatus {
  name: string;
  status: 'loading' | 'ready' | 'error';
  details?: string;
  error?: string;
}

interface OnnxCacheEntry {
  key: string;
  label: string;
  cached: boolean;
  sizeMb: number;
}

async function checkOnnxCache(): Promise<OnnxCacheEntry[]> {
  const entries: OnnxCacheEntry[] = [
    { key: 'vitDeepfakeExp',   label: 'ViT-Deepfake-Exp',   cached: false, sizeMb: 343 },
    { key: 'vitDeepfakeV2',    label: 'ViT-Deepfake-v2',    cached: false, sizeMb: 343 },
    { key: 'deepfakeDetector', label: 'DeepfakeDetector',   cached: false, sizeMb: 95  },
    { key: 'aiDetector',       label: 'SwinV2-AI-Detector', cached: false, sizeMb: 307 },
  ];

  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('onnx-model-cache', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => req.result.createObjectStore('models');
    });

    await Promise.all(entries.map(entry => new Promise<void>(resolve => {
      const tx = db.transaction('models', 'readonly');
      const req = tx.objectStore('models').getKey(entry.key);
      req.onsuccess = () => { entry.cached = req.result != null; resolve(); };
      req.onerror = () => resolve();
    })));
  } catch { /* IndexedDB not available */ }

  return entries;
}

const DiagnosticPanel = () => {
  const [statuses, setStatuses] = useState<ComponentStatus[]>([
    { name: 'TensorFlow.js', status: 'loading' },
    { name: 'Face Detection', status: 'loading' },
    { name: 'MesoNet Model', status: 'loading' },
    { name: 'Webcam Access', status: 'loading' },
  ]);
  const [onnxCache, setOnnxCache] = useState<OnnxCacheEntry[]>([]);

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
      stream.getTracks().forEach(track => track.stop());
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

    // Also refresh ONNX cache status
    const cache = await checkOnnxCache();
    // Merge with live model statuses to show in-memory ready state too
    const liveStatuses = getModelStatuses();
    cache.forEach(entry => {
      const live = liveStatuses.find(s => s.key === entry.key);
      if (live?.state === 'ready' || live?.state === 'cached') {
        entry.cached = true;
      }
    });
    setOnnxCache(cache);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const getStatusIcon = (status: ComponentStatus['status']) => {
    switch (status) {
      case 'ready':   return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':   return <XCircle className="h-4 w-4 text-red-500" />;
      case 'loading': return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: ComponentStatus['status']) => {
    switch (status) {
      case 'ready':   return <Badge className="bg-green-500">Ready</Badge>;
      case 'error':   return <Badge variant="destructive">Error</Badge>;
      case 'loading': return <Badge variant="secondary">Loading</Badge>;
    }
  };

  const cachedCount = onnxCache.filter(e => e.cached).length;
  const totalCacheMb = onnxCache.filter(e => e.cached).reduce((s, e) => s + e.sizeMb, 0);

  return (
    <>
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

        {/* ONNX IndexedDB Cache Status */}
        {onnxCache.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">
                ONNX Model Cache (IndexedDB) — {cachedCount}/{onnxCache.length} cached
                {cachedCount > 0 && <span className="text-muted-foreground font-normal ml-1">({totalCacheMb} MB)</span>}
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {onnxCache.map(entry => (
                <div key={entry.key} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/50">
                  <span className="truncate">{entry.label}</span>
                  {entry.cached
                    ? <Badge className="text-[10px] px-1 py-0 bg-blue-500 ml-2 shrink-0">cached</Badge>
                    : <Badge variant="outline" className="text-[10px] px-1 py-0 ml-2 shrink-0">{entry.sizeMb} MB</Badge>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

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

    {/* Performance Monitoring */}
    <PerformancePanel />
  </>
  );
};

export default DiagnosticPanel;