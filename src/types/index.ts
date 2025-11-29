// Type definitions for the deepfake detection app

export interface DetectionResult {
  isDeepfake: boolean;
  confidence: number;
  timestamp: number;
  faceDetected: boolean;
}

export interface FaceDetectionResult {
  detected: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: Array<{ x: number; y: number }>;
}

export interface VideoSource {
  type: 'upload' | 'webcam';
  stream?: MediaStream;
  file?: File;
}

export interface ModelConfig {
  modelPath?: string;
  threshold: number;
  minConfidence: number;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  user_id: string;
  detection_type: 'image' | 'video' | 'webcam';
  media_type: string; // mime type
  file_name?: string;
  file_size?: number; // in bytes
  detection_result: 'deepfake' | 'real' | 'uncertain';
  confidence_score: number;
  processing_time_ms: number;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  metadata?: {
    face_detected?: boolean;
    frame_count?: number;
    resolution?: string;
    duration_seconds?: number;
    model_version?: string;
    features_analyzed?: string[];
    anomalies_detected?: string[];
    // Additional fields for webcam detection
    blink_rate?: number;
    landmark_jitter?: number;
    snapshot?: boolean;
    // Additional fields for video detection
    frames_analyzed?: number;
    deepfake_frames?: number;
    suspicious_segments?: number;
    temporal_consistency?: number;
    [key: string]: any; // Allow additional custom fields
  };
  created_at: string;
  updated_at?: string;
}

export interface AuditLogCreate {
  user_id: string;
  detection_type: 'image' | 'video' | 'webcam';
  media_type: string;
  file_name?: string;
  file_size?: number;
  detection_result: 'deepfake' | 'real' | 'uncertain';
  confidence_score: number;
  processing_time_ms: number;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  metadata?: AuditLog['metadata'];
}

export interface AuditLogFilters {
  user_id?: string;
  detection_type?: 'image' | 'video' | 'webcam';
  detection_result?: 'deepfake' | 'real' | 'uncertain';
  start_date?: string;
  end_date?: string;
  min_confidence?: number;
  max_confidence?: number;
}

export interface AuditLogStats {
  total_detections: number;
  deepfake_count: number;
  real_count: number;
  uncertain_count: number;
  avg_confidence: number;
  avg_processing_time: number;
  detection_by_type: {
    image: number;
    video: number;
    webcam: number;
  };
}
