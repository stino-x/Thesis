import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { SettingsModal } from "@/components/SettingsModal";
import { AboutModal } from "@/components/AboutModal";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, ImageIcon, Video, Shield, History, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const navigate = useNavigate();

  const detectionModes = [
    {
      icon: Camera,
      title: "Webcam Detection",
      description: "Real-time deepfake analysis using your webcam with live face tracking and continuous monitoring.",
      tab: "webcam",
      features: ["Live overlay", "FPS tracking", "Snapshot capture"],
    },
    {
      icon: ImageIcon,
      title: "Image Analysis",
      description: "Upload an image for detailed deepfake analysis with facial landmark detection and texture checks.",
      tab: "image",
      features: ["Drag & drop", "Landmark detection", "Report export"],
    },
    {
      icon: Video,
      title: "Video Analysis",
      description: "Frame-by-frame video analysis with temporal consistency checks and suspicious segment detection.",
      tab: "video",
      features: ["Frame-by-frame", "Timeline view", "Audio analysis"],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatedBackground />

      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onAboutClick={() => setAboutOpen(true)}
      />

      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8 relative z-10">
        <Hero
          onUploadClick={() => navigate("/detect?tab=video")}
          onWebcamClick={() => navigate("/detect?tab=webcam")}
          onSamplesClick={() => navigate("/detect?tab=image")}
        />

        {/* Detection Mode Cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {detectionModes.map((mode, index) => (
            <motion.div
              key={mode.tab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
            >
              <Card
                className="glass-strong hover:shadow-lg hover:shadow-primary/10 transition-all cursor-pointer group h-full"
                onClick={() => navigate(`/detect?tab=${mode.tab}`)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <mode.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{mode.title}</CardTitle>
                  </div>
                  <CardDescription className="mt-2">{mode.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm text-muted-foreground mb-4">
                    {mode.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button variant="ghost" size="sm" className="group-hover:text-primary transition-colors p-0">
                    Get Started <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Links */}
        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Button variant="outline" className="gap-2" onClick={() => navigate("/audit-logs")}>
            <History className="h-4 w-4" />
            View Audit Logs
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/detect")}>
            <Shield className="h-4 w-4" />
            Go to Detection Suite
          </Button>
        </motion.div>
      </main>

      <footer className="glass-strong border-t border-border/50 py-6 mt-12 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p className="text-center md:text-left">© 2025 DeepFake Detector. BSc Thesis Project.</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button onClick={() => setAboutOpen(true)} className="hover:text-foreground transition-colors">
                About
              </button>
              <button onClick={() => navigate("/audit-logs")} className="hover:text-foreground transition-colors">
                Audit Logs
              </button>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                GitHub
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
