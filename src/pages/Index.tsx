import { useState } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { VideoUpload } from "@/components/VideoUpload";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ResultsPanel } from "@/components/ResultsPanel";
import { DetectionTimeline } from "@/components/DetectionTimeline";
import { SettingsModal } from "@/components/SettingsModal";
import { AboutModal } from "@/components/AboutModal";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

type AppState = "initial" | "uploaded" | "analyzing" | "results";

const Index = () => {
  const [appState, setAppState] = useState<AppState>("initial");
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { toast } = useToast();

  // Mock detection data
  const mockSegments = [
    { start: 0, end: 30, status: "authentic" as const, confidence: 0.92 },
    { start: 30, end: 60, status: "deepfake" as const, confidence: 0.78 },
    { start: 60, end: 90, status: "authentic" as const, confidence: 0.88 },
    { start: 90, end: 120, status: "deepfake" as const, confidence: 0.85 },
    { start: 120, end: 165, status: "authentic" as const, confidence: 0.91 },
  ];

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setAppState("analyzing");

    // Simulate analysis
    setTimeout(() => {
      setAppState("results");
      toast({
        title: "Analysis Complete",
        description: "Video has been analyzed for deepfake detection.",
      });
    }, 3000);
  };

  const handleWebcam = () => {
    toast({
      title: "Webcam Feature",
      description: "Webcam support will be available in the next update.",
    });
  };

  const handleSamples = () => {
    toast({
      title: "Sample Videos",
      description: "Sample videos will be available soon.",
    });
  };

  const handleSeek = (time: number) => {
    console.log("Seek to:", time);
  };

  const handleViewDetails = () => {
    toast({
      title: "Detailed Analysis",
      description: "Detailed analysis panel will be shown here.",
    });
  };

  const handleExportReport = () => {
    toast({
      title: "Export Report",
      description: "Report export feature coming soon.",
    });
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />
      
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onAboutClick={() => setAboutOpen(true)}
      />

      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8 relative z-10">
        {appState === "initial" && (
          <Hero
            onUploadClick={() => document.querySelector('input[type="file"]')?.dispatchEvent(new MouseEvent('click'))}
            onWebcamClick={handleWebcam}
            onSamplesClick={handleSamples}
          />
        )}

        {appState === "initial" && (
          <div className="mt-8 max-w-2xl mx-auto">
            <VideoUpload onFileSelect={handleFileSelect} />
          </div>
        )}

        {(appState === "analyzing" || appState === "results") && (
          <motion.div 
            className="space-y-6 sm:space-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
              <VideoPlayer
                videoSrc={videoSrc}
                confidence={appState === "results" ? 0.87 : undefined}
                isAnalyzing={appState === "analyzing"}
              />

              <ResultsPanel
                status={appState === "analyzing" ? "processing" : "deepfake"}
                confidence={0.87}
                detectionTime={2.3}
                framesAnalyzed={145}
                onViewDetails={handleViewDetails}
                onExportReport={handleExportReport}
              />
            </div>

            {appState === "results" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <DetectionTimeline
                  segments={mockSegments}
                  duration={165}
                  currentTime={0}
                  onSeek={handleSeek}
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </main>

      <footer className="glass-strong border-t border-border/50 py-6 mt-12 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p className="text-center md:text-left">© 2025 DeepFake Detector. BSc Thesis Project.</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button onClick={() => setAboutOpen(true)} className="hover:text-foreground transition-colors">
                About
              </button>
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                GitHub
              </a>
              <a href="mailto:contact@example.com" className="hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
};

export default Index;
