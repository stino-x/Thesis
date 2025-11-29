# Quick Start Guide: Implementing Audit Logs

This is a quick reference for adding audit logging to your existing deepfake detection components.

## 🚀 Setup (One-Time)

### 1. Database Setup
Follow the instructions in `AUDIT-LOGS-SETUP.md` to create the database table in Supabase.

### 2. Files Created
- ✅ `src/types/index.ts` - Type definitions (already updated)
- ✅ `src/lib/auditLogger.ts` - Main audit logging service
- ✅ `src/hooks/useAuditLog.ts` - React hook for easy usage
- ✅ `src/components/AuditLogs.tsx` - UI component to view logs
- ✅ `src/lib/auditLoggingExamples.tsx` - Integration examples

---

## 📝 Quick Integration (3 Steps)

### Step 1: Import the hook
```typescript
import { useAuditLog } from '@/hooks/useAuditLog';
```

### Step 2: Use in your component
```typescript
const MyDetectionComponent = () => {
  const { logDetection, getTimingHelper } = useAuditLog();
  
  // ... rest of your component
};
```

### Step 3: Log detections
```typescript
const handleDetection = async (file: File) => {
  const timer = getTimingHelper(); // Start timing
  
  try {
    // Your detection logic
    const result = await detectDeepfake(file);
    
    // Log the result
    await logDetection({
      detection_type: 'image', // or 'video' or 'webcam'
      media_type: file.type,
      file_name: file.name,
      file_size: file.size,
      detection_result: result.isDeepfake ? 'deepfake' : 'real',
      confidence_score: result.confidence,
      processing_time_ms: timer.getElapsedMs(),
      metadata: {
        face_detected: result.faceDetected,
        // Add any other relevant data
      },
    });
    
  } catch (error) {
    // Log failures too
    await logDetection({
      detection_type: 'image',
      media_type: file.type,
      file_name: file.name,
      file_size: file.size,
      detection_result: 'uncertain',
      confidence_score: 0,
      processing_time_ms: timer.getElapsedMs(),
    });
  }
};
```

---

## 🎨 Add to Your UI

### Add AuditLogs component to your app:

```typescript
// In your main app file or routing
import AuditLogs from '@/components/AuditLogs';

// Add as a page/tab
<Route path="/audit-logs" element={<AuditLogs />} />
```

Or add to an existing page:

```typescript
import AuditLogs from '@/components/AuditLogs';

const Dashboard = () => {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* Other content */}
      <AuditLogs />
    </div>
  );
};
```

---

## 🔧 Where to Add Logging

Add audit logging to these components:

### 1. VideoUpload.tsx
When user uploads and analyzes a video file:
```typescript
const handleVideoUpload = async (file: File) => {
  const timer = getTimingHelper();
  const result = await analyzeVideo(file);
  
  await logDetection({
    detection_type: 'video',
    media_type: file.type,
    file_name: file.name,
    file_size: file.size,
    detection_result: result.isDeepfake ? 'deepfake' : 'real',
    confidence_score: result.confidence,
    processing_time_ms: timer.getElapsedMs(),
  });
};
```

### 2. VideoPlayer.tsx
For webcam analysis:
```typescript
const handleWebcamCapture = async (blob: Blob) => {
  const timer = getTimingHelper();
  const result = await analyzeWebcamFrame(blob);
  
  await logDetection({
    detection_type: 'webcam',
    media_type: 'image/jpeg',
    file_name: `webcam_${Date.now()}.jpg`,
    file_size: blob.size,
    detection_result: result.isDeepfake ? 'deepfake' : 'real',
    confidence_score: result.confidence,
    processing_time_ms: timer.getElapsedMs(),
  });
};
```

### 3. Any image analysis component:
```typescript
const handleImageUpload = async (file: File) => {
  const timer = getTimingHelper();
  const result = await analyzeImage(file);
  
  await logDetection({
    detection_type: 'image',
    media_type: file.type,
    file_name: file.name,
    file_size: file.size,
    detection_result: result.isDeepfake ? 'deepfake' : 'real',
    confidence_score: result.confidence,
    processing_time_ms: timer.getElapsedMs(),
  });
};
```

---

## 📊 Features Available

### View Logs
- Table view with filtering
- Detailed view with full metadata
- Statistics dashboard

### Export
- CSV export with date ranges
- Filter by detection type, result, confidence

### Filters
- Detection type (image/video/webcam)
- Result (deepfake/real/uncertain)
- Date range
- Confidence threshold

### Statistics
- Total detections
- Deepfake vs real count
- Average confidence
- Average processing time
- Breakdown by type

---

## 🎯 Metadata Examples

Add useful metadata to track detection details:

```typescript
metadata: {
  // Basic info
  face_detected: true,
  model_version: '1.0.0',
  
  // For images
  resolution: '1920x1080',
  
  // For videos
  frame_count: 300,
  duration_seconds: 10.5,
  
  // Detection features
  features_analyzed: [
    'face_mesh',
    'texture',
    'lighting',
    'temporal_consistency'
  ],
  
  // Anomalies found
  anomalies_detected: [
    'inconsistent_lighting',
    'temporal_jitter',
    'unnatural_skin_texture'
  ],
  
  // Additional metrics
  blink_rate: 12.5,
  confidence_breakdown: {
    face_mesh: 0.95,
    texture: 0.87,
    lighting: 0.92
  }
}
```

---

## 🔒 Privacy & Security

- ✅ Users can only see their own logs (RLS policies)
- ✅ IP addresses are optional (privacy-friendly)
- ✅ Session tracking for debugging
- ✅ GDPR-compliant data retention
- ✅ Export for legal/compliance needs

---

## 🧪 Testing

Test that logging works:

```typescript
// In your browser console after a detection:
import { auditLogger } from '@/lib/auditLogger';

// Check recent logs
const logs = await auditLogger.getLogs();
console.log('Recent logs:', logs);

// Check statistics
const stats = await auditLogger.getStats();
console.log('Stats:', stats);
```

---

## 🐛 Troubleshooting

**Logs not appearing?**
1. Check user is authenticated
2. Verify Supabase table exists
3. Check RLS policies are set up
4. Look for errors in browser console

**Can't export CSV?**
1. Check browser allows downloads
2. Verify user has logs to export

**Slow performance?**
1. Add database indexes (see AUDIT-LOGS-SETUP.md)
2. Limit query results
3. Use date range filters

---

## ✨ Benefits

### For Users:
- Track their detection history
- Export for evidence/reports
- See detection patterns

### For You (Developer):
- Debug detection issues
- Monitor system usage
- Analyze performance
- Legal compliance
- Security audits

### For Researchers/Journalists:
- Verifiable detection timeline
- Tamper-evident audit trail
- Export for publications
- Metadata for analysis

---

## 🎉 You're Done!

Your audit logging system is now ready. Every detection will be automatically logged and users can view their history in the AuditLogs component.

**Next steps:**
1. Set up the database (see AUDIT-LOGS-SETUP.md)
2. Add `useAuditLog` to your detection components
3. Add `AuditLogs` component to your UI
4. Test with real detections
5. Configure data retention policies as needed
