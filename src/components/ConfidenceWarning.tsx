/**
 * Confidence Warning Component
 * 
 * Shows a warning when confidence scores are at extremes or when
 * the detection might be vulnerable to adversarial attacks.
 * 
 * This is a lightweight acknowledgment of the limitations mentioned
 * in the research-grade improvements section.
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfidenceWarningProps {
  confidence: number;
  isDeepfake: boolean;
  modelsUsed: string[];
}

export const ConfidenceWarning = ({ confidence, isDeepfake, modelsUsed }: ConfidenceWarningProps) => {
  // Show warning for extreme confidence (might be overconfident)
  const isExtremeConfidence = confidence > 0.95;
  
  // Show info about adversarial robustness
  const hasVisualModelsOnly = modelsUsed.every(m => 
    m.includes('ViT') || m.includes('MesoNet') || m.includes('Swin')
  );

  if (!isExtremeConfidence && !hasVisualModelsOnly) {
    return null; // No warnings needed
  }

  return (
    <div className="space-y-2 mt-4">
      {isExtremeConfidence && (
        <Alert variant="default" className="border-yellow-500/50">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-sm">High Confidence Score</AlertTitle>
          <AlertDescription className="text-xs">
            Confidence scores above 95% should be interpreted carefully. The model is very certain,
            but this doesn't account for adversarial attacks or novel manipulation techniques.
            Consider the multi-modal signals (PPG, lip-sync, metadata) for additional validation.
          </AlertDescription>
        </Alert>
      )}

      {hasVisualModelsOnly && (
        <Alert variant="default">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm">Visual Models Only</AlertTitle>
          <AlertDescription className="text-xs">
            This detection relied primarily on visual models (ViT, MesoNet). For higher confidence,
            enable multi-modal analysis (PPG, lip-sync, voice) which provides additional signals
            that are harder to manipulate. Backend CLIP/UnivFD also helps detect novel generators.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
