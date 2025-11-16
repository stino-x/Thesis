
import { CheckCircle, Github, Mail, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AboutModal = ({ open, onOpenChange }: AboutModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] glass-strong">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            About DeepFake Detector
          </DialogTitle>
          <DialogDescription>
            AI-powered deepfake detection technology
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">What is this?</h3>
            <p className="text-muted-foreground">
              This tool uses machine learning to detect AI-generated deepfake videos in
              real-time. It analyzes facial features, temporal consistency, and visual
              artifacts to determine video authenticity.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">How it works</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Upload a video or use your webcam</li>
              <li>AI analyzes facial features frame-by-frame</li>
              <li>Results show authenticity confidence score</li>
              <li>Heatmaps explain suspicious regions</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Accuracy</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="glass rounded-lg p-3">
                <div className="text-2xl font-bold text-primary">83.2%</div>
                <div className="text-muted-foreground">Test Accuracy</div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="text-2xl font-bold text-primary">~8%</div>
                <div className="text-muted-foreground">False Positive Rate</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Not 100% reliable - use as guidance, not definitive proof
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Privacy</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-status-authentic mt-0.5" />
                <span className="text-muted-foreground">
                  All processing happens in your browser
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-status-authentic mt-0.5" />
                <span className="text-muted-foreground">
                  No videos uploaded to servers
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-status-authentic mt-0.5" />
                <span className="text-muted-foreground">No data collection</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Learn More</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <BookOpen className="h-4 w-4" />
                  Documentation
                </a>
              </Button>
              <Button variant="outline" className="gap-2" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </Button>
              <Button variant="outline" className="gap-2" asChild>
                <a href="mailto:contact@example.com">
                  <Mail className="h-4 w-4" />
                  Contact
                </a>
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Built with React, TensorFlow.js, and MediaPipe
              <br />
              BSc Thesis Project
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
