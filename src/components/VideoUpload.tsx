import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoUploadProps {
  onFileSelect: (file: File) => void;
}

export const VideoUpload = ({ onFileSelect }: VideoUploadProps) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="glass rounded-xl p-8 hover-glow">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-primary/10 p-6">
          <Upload className="h-12 w-12 text-primary" />
        </div>
        <h3 className="text-2xl font-semibold">Upload Video</h3>
        <p className="text-center text-muted-foreground">
          Choose a video file to analyze for deepfake detection
        </p>
        <Button size="lg" className="gap-2" asChild>
          <label className="cursor-pointer">
            <Upload className="h-5 w-5" />
            Select File
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </Button>
        <p className="text-sm text-muted-foreground">
          Supports: MP4, WebM, MOV (max 100MB)
        </p>
      </div>
    </div>
  );
};
