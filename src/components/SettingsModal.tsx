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
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { useSettings } from "@/hooks/useSettings";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const { settings, updateSettings, resetSettings } = useSettings();

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
            <RadioGroup value={settings.processingSpeed} onValueChange={(v) => updateSettings({ processingSpeed: v as any })}>
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
              <span className="text-sm text-muted-foreground">{settings.sensitivity.toFixed(1)}</span>
            </div>
            <Slider
              value={[settings.sensitivity]}
              onValueChange={([v]) => updateSettings({ sensitivity: v })}
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
                  checked={settings.showBoundingBoxes}
                  onCheckedChange={(checked) => updateSettings({ showBoundingBoxes: checked as boolean })}
                />
                <Label htmlFor="bounding-boxes" className="font-normal cursor-pointer">
                  Show face bounding boxes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="heatmap"
                  checked={settings.showHeatmap}
                  onCheckedChange={(checked) => updateSettings({ showHeatmap: checked as boolean })}
                />
                <Label htmlFor="heatmap" className="font-normal cursor-pointer">
                  Show attention heatmap
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="confidence-badge"
                  checked={settings.showConfidenceBadge}
                  onCheckedChange={(checked) => updateSettings({ showConfidenceBadge: checked as boolean })}
                />
                <Label htmlFor="confidence-badge" className="font-normal cursor-pointer">
                  Show confidence badge
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <Label className="text-base font-semibold">Defensive Transformations</Label>
            <p className="text-xs text-muted-foreground">
              Apply transformations to defend against adversarial attacks
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="defensive"
                  checked={settings.enableDefensiveTransforms}
                  onCheckedChange={(checked) => updateSettings({ enableDefensiveTransforms: checked as boolean })}
                />
                <Label htmlFor="defensive" className="font-normal cursor-pointer">
                  Enable defensive transforms
                </Label>
              </div>
              {settings.enableDefensiveTransforms && (
                <div className="ml-6 space-y-3 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">JPEG Quality</Label>
                      <span className="text-xs text-muted-foreground">{settings.jpegQuality}</span>
                    </div>
                    <Slider
                      value={[settings.jpegQuality]}
                      onValueChange={([v]) => updateSettings({ jpegQuality: v })}
                      min={75}
                      max={100}
                      step={5}
                      className="cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Gaussian Blur</Label>
                      <span className="text-xs text-muted-foreground">{settings.gaussianBlur.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[settings.gaussianBlur]}
                      onValueChange={([v]) => updateSettings({ gaussianBlur: v })}
                      min={0}
                      max={3}
                      step={0.5}
                      className="cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="random-crop"
                      checked={settings.enableRandomCrop}
                      onCheckedChange={(checked) => updateSettings({ enableRandomCrop: checked as boolean })}
                    />
                    <Label htmlFor="random-crop" className="text-sm font-normal cursor-pointer">
                      Random crop & resize
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="resize"
                      checked={settings.enableResize}
                      onCheckedChange={(checked) => updateSettings({ enableResize: checked as boolean })}
                    />
                    <Label htmlFor="resize" className="text-sm font-normal cursor-pointer">
                      Scale down/up
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <Label className="text-base font-semibold">Research-Grade Features</Label>
            <p className="text-xs text-muted-foreground">
              Advanced detection features (adds ~250-500ms processing time)
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="calibration"
                  checked={settings.enableCalibration}
                  onCheckedChange={(checked) => updateSettings({ enableCalibration: checked as boolean })}
                />
                <Label htmlFor="calibration" className="font-normal cursor-pointer">
                  Confidence calibration (Platt scaling)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="adversarial"
                  checked={settings.enableAdversarialDetection}
                  onCheckedChange={(checked) => updateSettings({ enableAdversarialDetection: checked as boolean })}
                />
                <Label htmlFor="adversarial" className="font-normal cursor-pointer">
                  Adversarial attack detection
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="partial"
                  checked={settings.enablePartialDetection}
                  onCheckedChange={(checked) => updateSettings({ enablePartialDetection: checked as boolean })}
                />
                <Label htmlFor="partial" className="font-normal cursor-pointer">
                  Partial deepfake localization
                </Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={resetSettings}>
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
