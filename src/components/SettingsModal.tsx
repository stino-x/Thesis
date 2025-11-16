import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const [processingSpeed, setProcessingSpeed] = useState("balanced");
  const [sensitivity, setSensitivity] = useState([0.7]);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showConfidenceBadge, setShowConfidenceBadge] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-strong">
        <DialogHeader>
          <DialogTitle className="text-2xl">Settings</DialogTitle>
          <DialogDescription>
            Configure detection parameters and display options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Processing Speed</Label>
            <RadioGroup value={processingSpeed} onValueChange={setProcessingSpeed}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fast" id="fast" />
                <Label htmlFor="fast" className="font-normal cursor-pointer">
                  Fast (lower accuracy, faster)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="balanced" id="balanced" />
                <Label htmlFor="balanced" className="font-normal cursor-pointer">
                  Balanced (recommended)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="accurate" id="accurate" />
                <Label htmlFor="accurate" className="font-normal cursor-pointer">
                  Accurate (higher accuracy, slower)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Detection Sensitivity</Label>
              <span className="text-sm text-muted-foreground">{sensitivity[0].toFixed(1)}</span>
            </div>
            <Slider
              value={sensitivity}
              onValueChange={setSensitivity}
              min={0.5}
              max={0.9}
              step={0.1}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Lower = fewer false positives
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Display Options</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bounding-boxes"
                  checked={showBoundingBoxes}
                  onCheckedChange={(checked) => setShowBoundingBoxes(checked as boolean)}
                />
                <Label htmlFor="bounding-boxes" className="font-normal cursor-pointer">
                  Show face bounding boxes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="heatmap"
                  checked={showHeatmap}
                  onCheckedChange={(checked) => setShowHeatmap(checked as boolean)}
                />
                <Label htmlFor="heatmap" className="font-normal cursor-pointer">
                  Show attention heatmap
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confidence-badge"
                  checked={showConfidenceBadge}
                  onCheckedChange={(checked) => setShowConfidenceBadge(checked as boolean)}
                />
                <Label htmlFor="confidence-badge" className="font-normal cursor-pointer">
                  Show confidence badge
                </Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1">
              Reset to Defaults
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
