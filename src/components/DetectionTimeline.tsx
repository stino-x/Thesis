// import { CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";

interface TimelineSegment {
  start: number;
  end: number;
  status: "authentic" | "deepfake" | "uncertain";
  confidence: number;
}

interface DetectionTimelineProps {
  segments: TimelineSegment[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export const DetectionTimeline = ({
  segments,
  duration,
  currentTime,
  onSeek,
}: DetectionTimelineProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "authentic":
        return "bg-status-authentic";
      case "deepfake":
        return "bg-status-deepfake";
      case "uncertain":
        return "bg-status-uncertain";
      default:
        return "bg-muted";
    }
  };

  // const getStatusIcon = (status: string) => {
  //   switch (status) {
  //     case "authentic":
  //       return <CheckCircle className="h-3 w-3" />;
  //     case "deepfake":
  //       return <AlertTriangle className="h-3 w-3" />;
  //     case "uncertain":
  //       return <HelpCircle className="h-3 w-3" />;
  //     default:
  //       return null;
  //   }
  // };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="glass rounded-xl p-6 space-y-4 hover-glow">
      <h3 className="text-lg font-semibold">Detection Timeline</h3>
      
      <div className="relative">
        <div className="relative h-12 w-full overflow-hidden rounded-lg bg-muted">
          {segments.map((segment, index) => {
            const left = (segment.start / duration) * 100;
            const width = ((segment.end - segment.start) / duration) * 100;
            
            return (
              <button
                key={index}
                className={`absolute top-0 h-full ${getStatusColor(
                  segment.status
                )} transition-all hover:brightness-110 cursor-pointer border-r border-background/20`}
                style={{ left: `${left}%`, width: `${width}%` }}
                onClick={() => onSeek(segment.start)}
                title={`${segment.status} (${Math.round(segment.confidence * 100)}%)`}
              />
            );
          })}
          
          {/* Current time indicator */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground shadow-lg"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>0:00</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-status-authentic" />
          <span>Authentic</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-status-deepfake" />
          <span>Suspicious</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-status-uncertain" />
          <span>Uncertain</span>
        </div>
      </div>
    </div>
  );
};
