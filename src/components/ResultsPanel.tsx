import { CheckCircle, AlertTriangle, HelpCircle, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

type DetectionStatus = "authentic" | "deepfake" | "uncertain" | "processing";

interface ResultsPanelProps {
  status: DetectionStatus;
  confidence: number;
  detectionTime?: number;
  framesAnalyzed?: number;
  onViewDetails?: () => void;
  onExportReport?: () => void;
}

export const ResultsPanel = ({
  status,
  confidence,
  detectionTime,
  framesAnalyzed,
  onViewDetails,
  onExportReport,
}: ResultsPanelProps) => {
  const renderIcon = () => {
    switch (status) {
      case "authentic":
        return <CheckCircle className="h-12 w-12" />;
      case "deepfake":
        return <AlertTriangle className="h-12 w-12" />;
      case "uncertain":
        return <HelpCircle className="h-12 w-12" />;
      case "processing":
        return <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />;
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case "authentic":
        return {
          label: "LIKELY AUTHENTIC",
          gradient: "gradient-authentic",
          textColor: "text-status-authentic",
        };
      case "deepfake":
        return {
          label: "LIKELY DEEPFAKE",
          gradient: "gradient-deepfake",
          textColor: "text-status-deepfake",
        };
      case "uncertain":
        return {
          label: "UNCERTAIN - NEEDS REVIEW",
          gradient: "bg-status-uncertain",
          textColor: "text-status-uncertain",
        };
      case "processing":
        return {
          label: "ANALYZING VIDEO...",
          gradient: "bg-status-processing",
          textColor: "text-status-processing",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <motion.div 
      className="glass rounded-xl overflow-hidden hover-glow animate-scale-in"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4 }}
    >
      <div className={`${config.gradient} p-6 text-center`}>
        <motion.div 
          className="flex justify-center mb-4"
          animate={status === "processing" ? { rotate: 360 } : {}}
          transition={status === "processing" ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
        >
          {renderIcon()}
        </motion.div>
        <motion.h2 
          className="text-2xl font-bold mb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {config.label}
        </motion.h2>
      </div>

      <div className="p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Confidence</span>
            <motion.span 
              className="text-2xl font-bold"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {Math.round(confidence * 100)}%
            </motion.span>
          </div>
          <Progress value={confidence * 100} className="h-2" />
        </motion.div>

        {detectionTime !== undefined && framesAnalyzed !== undefined && (
          <motion.div 
            className="grid grid-cols-2 gap-4 text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div>
              <div className="text-muted-foreground">Detection Time</div>
              <div className="text-lg font-semibold">{detectionTime.toFixed(1)}s</div>
            </div>
            <div>
              <div className="text-muted-foreground">Frames Analyzed</div>
              <div className="text-lg font-semibold">{framesAnalyzed}</div>
            </div>
          </motion.div>
        )}

        {status !== "processing" && (
          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Button
              className="w-full gap-2 glass hover-glow"
              variant="outline"
              onClick={onViewDetails}
            >
              <Eye className="h-4 w-4" />
              View Detailed Analysis
            </Button>
            <Button
              className="w-full gap-2 glass hover-glow"
              variant="outline"
              onClick={onExportReport}
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
