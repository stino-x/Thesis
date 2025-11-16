import { Play, Pause, Volume2, Maximize, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface VideoPlayerProps {
  videoSrc: string;
  confidence?: number;
  isAnalyzing?: boolean;
}

export const VideoPlayer = ({ videoSrc, confidence, isAnalyzing }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div 
      className="glass rounded-xl overflow-hidden hover-glow"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4 }}
    >
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          className="h-full w-full"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {confidence !== undefined && (
          <motion.div 
            className="absolute top-4 right-4 glass-strong rounded-lg px-4 py-2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="text-sm font-medium">Confidence</div>
            <motion.div 
              className="text-2xl font-bold"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              {Math.round(confidence * 100)}%
            </motion.div>
          </motion.div>
        )}

        {isAnalyzing && (
          <motion.div 
            className="absolute inset-0 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-strong rounded-xl p-6 text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-lg font-medium">Analyzing...</p>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={togglePlay}
            className="hover:bg-primary/20"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>

          <div className="flex-1">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={(value) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = value[0];
                }
              }}
              className="cursor-pointer"
            />
          </div>

          <span className="text-sm text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost">
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
