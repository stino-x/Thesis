# Audit Logs - Complete Guide

**Complete guide for implementing and using the audit logging system.**

---

## Overview

The audit logging system tracks all deepfake detection operations, providing:
- **When**: Timestamp of detection
- **Where**: IP address and user agent (optional)
- **By Whom**: User ID and session ID
- **What**: File details, detection type, results, and metadata

**Use Cases**:
- Legal workflows (evidence trail)
- Journalistic verification
- Compliance (GDPR, data retention)
- Security audits
- Analytics and insights

---

## Quick Start

### 1. Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    detection_type VARCHAR(50) NOT NULL CHECK (detection_type IN ('image', 'video', 'webcam')),
    media_type VARCHAR(100) NOT NULL,
    file_name TEXT,
    file_size BIGINT,
    detection_result VARCHAR(50) NOT NULL CHECK (detection_result IN ('deepfake', 'real', 'uncertain')),
    confidence_score DECIMAL(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    processing_time_ms INTEGER NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_detection_type ON public.audit_logs(detection_type);
CREATE INDEX idx_audit_logs_result ON public.audit_logs(detection_result);
CREATE INDEX idx_audit_logs_session ON public.audit_logs(session_id);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own logs"
    ON public.audit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_audit_logs_updated_at
    BEFORE UPDATE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2. Code Integration

The audit logging system is already integrated. Here's how to use it:

```typescript
import { useAuditLog } from '@/hooks/useAuditLog';

const MyComponent = () => {
  const { logDetection, getTimingHelper } = useAuditLog();
  
  const handleDetection = async (file: File) => {
    const timer = getTimingHelper(); // Start timing
    
    // Your detection logic
    const result = await detectDeepfake(file);
    
    // Log the result
    await logDetection({
      detection_type: 'image',
      media_type: file.type,
      file_name: file.name,
      file_size: file.size,
      detection_result: result.isDeepfake ? 'deepfake' : 'real',
      confidence_score: result.confidence,
      processing_time_ms: timer.getElapsedMs(),
      metadata: {
        models_used: result.modelsUsed,
        anomalies: result.anomalies,
      },
    });
  };
};
```

---

## Features

### 1. Automatic Logging
All detection operations are automatically logged:
- Image uploads
- Video analysis
- Webcam detections

### 2. Statistics Dashboard
View aggregate statistics:
- Total detections
- Deepfake vs real ratio
- Average confidence scores
- Processing time metrics

### 3. Filtering & Search
Filter logs by:
- Detection type (image/video/webcam)
- Result (deepfake/real)
- Date range
- Confidence threshold

### 4. CSV Export
Export logs to CSV for:
- Excel analysis
- Python/R data science
- Compliance reporting
- Legal documentation

### 5. Session Tracking
Automatic session tracking:
- Groups related detections
- Tracks user sessions
- Helps identify patterns

---

## API Reference

### useAuditLog Hook

```typescript
const { logDetection, getTimingHelper } = useAuditLog();
```

#### logDetection(data)
Logs a detection operation.

**Parameters**:
```typescript
{
  detection_type: 'image' | 'video' | 'webcam';
  media_type: string;
  file_name?: string;
  file_size?: number;
  detection_result: 'deepfake' | 'real' | 'uncertain';
  confidence_score: number; // 0-1
  processing_time_ms: number;
  metadata?: Record<string, any>;
}
```

#### getTimingHelper()
Returns a timing helper for tracking processing time.

**Methods**:
- `getElapsedMs()`: Returns elapsed time in milliseconds

---

## UI Component

### AuditLogs Component

Located at `src/components/AuditLogs.tsx`

**Features**:
- Statistics dashboard
- Filterable table view
- Detailed log view
- CSV export
- Responsive design

**Usage**:
```typescript
import { AuditLogs } from '@/components/AuditLogs';

<AuditLogs />
```

---

## Security

### Row Level Security (RLS)
- Users can only view their own logs
- Users can only insert logs for themselves
- Admins can view all logs (optional policy)

### Data Privacy
- IP addresses are optional
- User agents are optional
- Metadata is flexible (JSONB)
- Compliant with GDPR

### Data Retention
Optional: Set up automatic deletion of old logs:

```sql
-- Delete logs older than 90 days
DELETE FROM public.audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Testing

### Manual Test
```sql
-- Insert test log
INSERT INTO public.audit_logs (
  user_id,
  detection_type,
  media_type,
  file_name,
  file_size,
  detection_result,
  confidence_score,
  processing_time_ms
) VALUES (
  auth.uid(),
  'image',
  'image/jpeg',
  'test.jpg',
  1024000,
  'deepfake',
  0.8523,
  1234
);

-- Query your logs
SELECT * FROM public.audit_logs
WHERE user_id = auth.uid()
ORDER BY created_at DESC;
```

### Integration Test
1. Sign in to the app
2. Upload an image for detection
3. Check the Audit Logs page
4. Verify the log appears
5. Export to CSV and verify format

---

## Troubleshooting

### Logs not appearing?
1. Check if user is authenticated
2. Verify RLS policies are correct
3. Check browser console for errors
4. Verify Supabase connection

### Export not working?
1. Check if logs exist
2. Verify user has permission
3. Check browser console for errors

### Performance issues?
1. Verify indexes are created
2. Consider data retention policy
3. Optimize queries with filters

---

## Files Reference

### Core Files
- `src/lib/auditLogger.ts` - Main service
- `src/hooks/useAuditLog.ts` - React hook
- `src/components/AuditLogs.tsx` - UI component
- `src/types/index.ts` - Type definitions

### Integration Examples
- `src/components/detection/ImageAnalyzer.tsx`
- `src/components/detection/VideoAnalyzer.tsx`
- `src/components/detection/WebcamDetector.tsx`

---

## Best Practices

1. **Always log detections**: Don't skip logging for any detection type
2. **Include metadata**: Add relevant context (models used, anomalies, etc.)
3. **Track timing**: Use `getTimingHelper()` for accurate timing
4. **Handle errors**: Wrap logging in try-catch to prevent failures
5. **Review regularly**: Check logs for patterns and issues
6. **Export periodically**: Back up logs for compliance
7. **Set retention**: Delete old logs per your policy

---

## Support

For issues or questions:
1. Check this guide
2. Review code examples
3. Check Supabase logs
4. Contact development team

---

**Status**: ✅ Fully Implemented  
**Last Updated**: April 19, 2026
