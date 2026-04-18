/**
 * Model Loading Status — shows ONNX download progress on first visit.
 * Subscribes to the onnxDetector's loading events so users know
 * the 1.1 GB models are downloading, not that the app is broken.
 */

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Download, Clock } from 'lucide-react';

export interface ModelStatus {
  key: string;
  label: string;
  state: 'pending' | 'downloading' | 'cached' | 'ready' | 'error';
  sizeMb: number;
}

// Singleton event bus — onnxDetector.ts fires events into this
const listeners = new Set<(statuses: ModelStatus[]) => void>();
let currentStatuses: ModelStatus[] = [
  { key: 'vitDeepfakeExp',   label: 'ViT-Deepfake-Exp',   state: 'pending', sizeMb: 343 },
  { key: 'vitDeepfakeV2',    label: 'ViT-Deepfake-v2',    state: 'pending', sizeMb: 343 },
  { key: 'deepfakeDetector', label: 'DeepfakeDetector',   state: 'pending', sizeMb: 95  },
  { key: 'aiDetector',       label: 'SwinV2-AI-Detector', state: 'pending', sizeMb: 307 },
];

export function updateModelStatus(key: string, state: ModelStatus['state']) {
  currentStatuses = currentStatuses.map(s => s.key === key ? { ...s, state } : s);
  listeners.forEach(fn => fn([...currentStatuses]));
}

export function getModelStatuses(): ModelStatus[] {
  return [...currentStatuses];
}

export function subscribeModelStatuses(fn: (statuses: ModelStatus[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const ModelLoadingStatus = () => {
  const [statuses, setStatuses] = useState<ModelStatus[]>(getModelStatuses());

  useEffect(() => {
    listeners.add(setStatuses);
    return () => { listeners.delete(setStatuses); };
  }, []);

  const allReady = statuses.every(s => s.state === 'ready' || s.state === 'cached');
  const anyDownloading = statuses.some(s => s.state === 'downloading');
  const readyCount = statuses.filter(s => s.state === 'ready' || s.state === 'cached').length;

  if (allReady) return null; // hide once everything is loaded

  return (
    <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {anyDownloading
            ? <><Download className="h-4 w-4 animate-bounce text-primary" /> Downloading ML models...</>
            : <><Clock className="h-4 w-4 text-muted-foreground" /> Loading ML models...</>
          }
        </div>
        <span className="text-xs text-muted-foreground">{readyCount}/{statuses.length} ready</span>
      </div>

      <Progress value={(readyCount / statuses.length) * 100} className="h-1.5" />

      <div className="grid grid-cols-2 gap-2">
        {statuses.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            {s.state === 'ready' || s.state === 'cached'
              ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
              : s.state === 'downloading'
              ? <Download className="h-3 w-3 text-primary animate-pulse shrink-0" />
              : s.state === 'error'
              ? <span className="h-3 w-3 rounded-full bg-red-500 shrink-0 inline-block" />
              : <span className="h-3 w-3 rounded-full bg-muted-foreground/30 shrink-0 inline-block" />
            }
            <span className="truncate text-muted-foreground">{s.label}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
              {s.state === 'cached' ? 'cached' : `${s.sizeMb}MB`}
            </Badge>
          </div>
        ))}
      </div>

      {anyDownloading && (
        <p className="text-xs text-muted-foreground">
          Models are cached after first download — subsequent visits load instantly.
        </p>
      )}
    </div>
  );
};
