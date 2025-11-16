import { Upload, Video, Film, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";

interface HeroProps {
  onUploadClick: () => void;
  onWebcamClick: () => void;
  onSamplesClick: () => void;
}

export const Hero = ({ onUploadClick, onWebcamClick, onSamplesClick }: HeroProps) => {
  return (
    <section className="relative overflow-hidden rounded-2xl">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
      
      <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.h1 
            className="mb-4 text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <span className="text-gradient">Real-time Deepfake</span>
            <br />
            Detection
          </motion.h1>
        </motion.div>

        <motion.p 
          className="mb-8 sm:mb-12 max-w-2xl text-base sm:text-lg lg:text-xl text-muted-foreground px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Verify video authenticity using AI-powered computer vision technology
        </motion.p>

        <motion.div 
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-12 w-full sm:w-auto px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              className="group gap-2 gradient-hero hover:opacity-90 w-full sm:w-auto shadow-lg"
              onClick={onUploadClick}
            >
              <Upload className="h-5 w-5 transition-transform group-hover:scale-110" />
              Upload Video
              <Sparkles className="h-4 w-4 opacity-70" />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 glass hover-glow w-full sm:w-auto"
              onClick={onWebcamClick}
            >
              <Video className="h-5 w-5" />
              Use Webcam
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 glass hover-glow w-full sm:w-auto"
              onClick={onSamplesClick}
            >
              <Film className="h-5 w-5" />
              Try Samples
            </Button>
          </motion.div>
        </motion.div>

        <motion.div 
          className="glass rounded-xl border-2 border-dashed border-border p-8 sm:p-12 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/20 w-full max-w-2xl mx-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          whileHover={{ scale: 1.02, borderColor: "hsl(var(--primary))" }}
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Upload className="h-10 sm:h-12 w-10 sm:w-12 text-muted-foreground" />
            </motion.div>
            <p className="text-base sm:text-lg font-medium">Drag & drop video here</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Supports: MP4, WebM, MOV (max 100MB)
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
