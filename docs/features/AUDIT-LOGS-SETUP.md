# Audit Logs Database Setup Guide

This guide explains how to set up the audit logs table in Supabase for tracking deepfake detection operations.

## 📋 Overview

The audit logs system provides comprehensive tracking of all detection operations, including:
- **When**: Timestamp of detection
- **Where**: IP address and user agent (optional)
- **By Whom**: User ID and session ID
- **What**: File details, detection type, results, and metadata

This is crucial for:
- **Legal workflows**: Evidence trail for court proceedings
- **Journalistic verification**: Proof of detection timeline
- **Compliance**: GDPR, data retention policies
- **Security audits**: Monitoring system usage
- **Analytics**: Understanding detection patterns

---

## 🗄️ Database Schema

### Table: `audit_logs`

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

-- Create indexes for better query performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_detection_type ON public.audit_logs(detection_type);
CREATE INDEX idx_audit_logs_detection_result ON public.audit_logs(detection_result);
CREATE INDEX idx_audit_logs_session_id ON public.audit_logs(session_id);

-- Create composite index for common query patterns
CREATE INDEX idx_audit_logs_user_date ON public.audit_logs(user_id, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE public.audit_logs IS 'Audit trail for all deepfake detection operations';
COMMENT ON COLUMN public.audit_logs.detection_type IS 'Type of detection: image, video, or webcam';
COMMENT ON COLUMN public.audit_logs.detection_result IS 'Result of detection: deepfake, real, or uncertain';
COMMENT ON COLUMN public.audit_logs.confidence_score IS 'Confidence score from 0.0 to 1.0';
COMMENT ON COLUMN public.audit_logs.processing_time_ms IS 'Time taken to process in milliseconds';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional metadata in JSON format (face detected, anomalies, etc.)';
```

---

## 🔒 Row Level Security (RLS) Policies

Enable RLS and create policies to ensure users can only access their own logs:

```sql
-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
ON public.audit_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own audit logs
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own audit logs (optional, usually not needed)
CREATE POLICY "Users can update their own audit logs"
ON public.audit_logs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own old audit logs (for GDPR compliance)
CREATE POLICY "Users can delete their own audit logs"
ON public.audit_logs
FOR DELETE
USING (auth.uid() = user_id);

-- Optional: Admin policy to view all logs (if you have admin role)
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
);
```

---

## 🔄 Automatic Timestamp Updates

Create a trigger to automatically update the `updated_at` field:

```sql
-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_audit_logs_updated_at
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## 🗑️ Automatic Data Retention (Optional)

If you want to automatically delete old logs for GDPR compliance:

```sql
-- Function to delete logs older than specified days
CREATE OR REPLACE FUNCTION delete_old_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule automatic cleanup (run daily via pg_cron extension or manually)
-- If you have pg_cron enabled:
-- SELECT cron.schedule('delete-old-audit-logs', '0 2 * * *', $$SELECT delete_old_audit_logs(90)$$);
```

---

## 📊 Useful Queries

### Get user's detection statistics

```sql
SELECT 
    user_id,
    COUNT(*) as total_detections,
    COUNT(*) FILTER (WHERE detection_result = 'deepfake') as deepfake_count,
    COUNT(*) FILTER (WHERE detection_result = 'real') as real_count,
    COUNT(*) FILTER (WHERE detection_result = 'uncertain') as uncertain_count,
    AVG(confidence_score) as avg_confidence,
    AVG(processing_time_ms) as avg_processing_time,
    COUNT(*) FILTER (WHERE detection_type = 'image') as image_count,
    COUNT(*) FILTER (WHERE detection_type = 'video') as video_count,
    COUNT(*) FILTER (WHERE detection_type = 'webcam') as webcam_count
FROM public.audit_logs
WHERE user_id = 'YOUR_USER_ID'
GROUP BY user_id;
```

### Get recent detections

```sql
SELECT 
    id,
    detection_type,
    file_name,
    detection_result,
    confidence_score,
    processing_time_ms,
    created_at
FROM public.audit_logs
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 20;
```

### Get detections by date range

```sql
SELECT *
FROM public.audit_logs
WHERE user_id = 'YOUR_USER_ID'
  AND created_at BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY created_at DESC;
```

### Find suspicious patterns

```sql
-- Find multiple deepfakes detected in short time
SELECT 
    user_id,
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) FILTER (WHERE detection_result = 'deepfake') as deepfake_count
FROM public.audit_logs
GROUP BY user_id, hour
HAVING COUNT(*) FILTER (WHERE detection_result = 'deepfake') > 5
ORDER BY hour DESC;
```

---

## 🔍 Metadata Field Examples

The `metadata` JSONB field can store additional detection information:

```json
{
  "face_detected": true,
  "frame_count": 300,
  "resolution": "1920x1080",
  "duration_seconds": 10.5,
  "model_version": "1.0.0",
  "features_analyzed": [
    "face_mesh",
    "temporal_consistency",
    "lip_sync",
    "lighting_consistency",
    "optical_flow"
  ],
  "anomalies_detected": [
    "inconsistent_lighting",
    "temporal_jitter",
    "unnatural_skin_texture"
  ],
  "blink_rate": 12.5,
  "confidence_scores": {
    "face_mesh": 0.95,
    "texture": 0.87,
    "lighting": 0.92
  }
}
```

### Query metadata

```sql
-- Find all detections where face was not detected
SELECT *
FROM public.audit_logs
WHERE metadata->>'face_detected' = 'false';

-- Find detections with specific anomaly
SELECT *
FROM public.audit_logs
WHERE metadata->'anomalies_detected' ? 'inconsistent_lighting';

-- Get average resolution
SELECT 
    metadata->>'resolution' as resolution,
    COUNT(*) as count
FROM public.audit_logs
WHERE metadata ? 'resolution'
GROUP BY resolution
ORDER BY count DESC;
```

---

## 🚀 Deployment Checklist

- [ ] Create `audit_logs` table with all columns
- [ ] Create indexes for performance
- [ ] Enable Row Level Security (RLS)
- [ ] Create RLS policies for user access
- [ ] Create `updated_at` trigger
- [ ] (Optional) Set up automatic data retention
- [ ] Test insert/select operations
- [ ] Verify RLS policies work correctly
- [ ] Document any custom metadata fields your app uses

---

## 🔐 Security Best Practices

1. **Always use RLS**: Never allow direct table access without RLS policies
2. **Sanitize file names**: Remove sensitive information before logging
3. **IP addresses**: Consider privacy implications before storing IP addresses
4. **GDPR compliance**: Implement data retention policies
5. **Audit the audits**: Monitor who accesses audit logs
6. **Encryption**: Supabase encrypts data at rest by default
7. **Backups**: Regular backups of audit logs for legal requirements

---

## 📈 Performance Optimization

For high-volume applications:

1. **Partitioning**: Consider table partitioning by date
2. **Archive old data**: Move old logs to archive tables
3. **Materialized views**: For statistics queries
4. **Connection pooling**: Use Supabase connection pooler

```sql
-- Example: Create monthly partitions (PostgreSQL 10+)
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

## 🧪 Testing

Test your setup:

```typescript
import { auditLogger } from '@/lib/auditLogger';

// Test logging
const result = await auditLogger.logDetection({
  user_id: 'test-user-id',
  detection_type: 'image',
  media_type: 'image/jpeg',
  file_name: 'test.jpg',
  file_size: 1024000,
  detection_result: 'real',
  confidence_score: 0.95,
  processing_time_ms: 1234,
  metadata: {
    face_detected: true,
    model_version: '1.0.0'
  }
});

console.log('Audit log created:', result);

// Test retrieval
const logs = await auditLogger.getLogs({ user_id: 'test-user-id' });
console.log('Retrieved logs:', logs);

// Test statistics
const stats = await auditLogger.getStats('test-user-id');
console.log('Statistics:', stats);
```

---

## 📞 Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify RLS policies are correctly configured
3. Ensure user authentication is working
4. Check that indexes are created
5. Review the TypeScript types match the database schema

---

## 🎯 Next Steps

After setting up the database:

1. Integrate audit logging into your detection components (see `auditLoggingExamples.tsx`)
2. Add the `AuditLogs` component to your app's navigation
3. Test with real detections
4. Set up monitoring and alerts for suspicious patterns
5. Configure data retention policies
6. Export audit logs for legal/compliance needs

---

## 📝 License & Compliance Notes

**Important for legal/journalistic use:**

- Audit logs create a tamper-evident trail
- Timestamps are in UTC with timezone information
- User IDs are permanently linked to auth system
- Consider adding digital signatures for non-repudiation
- Consult legal counsel for specific compliance requirements

---

**Database setup complete!** 🎉

Your audit logging system is now ready for production use.
