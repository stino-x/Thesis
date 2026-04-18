/**
 * Enhanced Results Panel
 * 
 * Displays calibrated confidence, adversarial warnings, and partial deepfake detection
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, Shield, Target, Info, CheckCircle, XCircle } from 'lucide-react';
import type { EnhancedDetectionResult } from '@/lib/tensorflow/enhancedDetector';

interface EnhancedResultsPanelProps {
  result: EnhancedDetectionResult;
  showHeatmap?: boolean;
  onHeatmapToggle?: () => void;
}

export const EnhancedResultsPanel = ({ result, showHeatmap, onHeatmapToggle }: EnhancedResultsPanelProps) => {
  const { calibrated, adversarial, partial } = result;
  
  return (
    <div className="space-y-4">
      {/* Calibrated Confidence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Calibrated Confidence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Probability</span>
              <span className="font-medium">
                {(calibrated.probability * 100).toFixed(1)}%
              </span>
            </div>
            <Progress value={calibrated.probability * 100} className="h-2" />
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>95% Confidence Interval:</strong>{' '}
              {(calibrated.confidenceInterval[0] * 100).toFixed(1)}% -{' '}
              {(calibrated.confidenceInterval[1] * 100).toFixed(1)}%
            </p>
            <p>
              <strong>Reliability:</strong>{' '}
              {(calibrated.reliability * 100).toFixed(0)}%
              {calibrated.reliability < 0.5 && ' (Low - models disagree)'}
            </p>
          </div>
          
          {!calibrated.isWellCalibrated && calibrated.calibrationWarning && (
            <Alert variant="default" className="border-yellow-500/50">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-xs">
                {calibrated.calibrationWarning}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="pt-2 border-t text-xs text-muted-foreground">
            <p>
              <Info className="h-3 w-3 inline mr-1" />
              Calibrated using Platt scaling - converts raw scores to meaningful probabilities
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Adversarial Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Adversarial Attack Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Attack Detected</span>
            {adversarial.isAdversarial ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Yes ({(adversarial.confidence * 100).toFixed(0)}%)
              </Badge>
            ) : (
              <Badge className="gap-1">
                <CheckCircle className="h-3 w-3" />
                No
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Robustness Level</span>
            <Badge variant={
              adversarial.robustnessLevel === 'high' ? 'default' :
              adversarial.robustnessLevel === 'medium' ? 'secondary' :
              'outline'
            }>
              {adversarial.robustnessLevel.toUpperCase()}
            </Badge>
          </div>
          
          {adversarial.indicators.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="indicators">
                <AccordionTrigger className="text-sm">
                  Attack Indicators ({adversarial.indicators.length})
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {adversarial.indicators.map((indicator, i) => (
                      <li key={i}>• {indicator}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          
          {adversarial.isAdversarial && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">Recommendation</AlertTitle>
              <AlertDescription className="text-xs">
                {adversarial.recommendation}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="pt-2 border-t text-xs text-muted-foreground">
            <p>
              <Info className="h-3 w-3 inline mr-1" />
              Detects adversarial perturbations designed to fool the models
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Partial Deepfake Detection */}
      {partial.hasPartialManipulation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Localized Manipulation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="default" className="border-orange-500/50">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <AlertTitle className="text-sm">Partial Deepfake Detected</AlertTitle>
              <AlertDescription className="text-xs">
                {partial.manipulationType} - {partial.suspiciousRegions.length} suspicious region(s) found
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Manipulation Confidence</span>
                <span className="font-medium">
                  {(partial.overallConfidence * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={partial.overallConfidence * 100} className="h-2" />
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="regions">
                <AccordionTrigger className="text-sm">
                  Suspicious Regions ({partial.suspiciousRegions.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {partial.suspiciousRegions.map((region, i) => (
                      <div key={i} className="p-2 bg-muted rounded text-xs">
                        <div className="flex justify-between mb-1">
                          <Badge variant="outline" className="text-[10px]">
                            {region.type.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-muted-foreground">
                            {(region.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="text-muted-foreground">{region.reason}</p>
                        <p className="text-muted-foreground mt-1">
                          Region: ({region.x}, {region.y}) - {region.width}×{region.height}px
                        </p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {onHeatmapToggle && (
              <button
                onClick={onHeatmapToggle}
                className="w-full text-xs text-primary hover:underline"
              >
                {showHeatmap ? 'Hide' : 'Show'} Heatmap Overlay
              </button>
            )}
            
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <p>
                <Info className="h-3 w-3 inline mr-1" />
                Detects localized manipulations (face swap, mouth reenactment, etc.)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
