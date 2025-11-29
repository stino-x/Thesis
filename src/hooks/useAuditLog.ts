import { useCallback } from 'react';
import { auditLogger } from '@/lib/auditLogger';
import { useAuth } from './useAuth';
import { AuditLogCreate } from '@/types';

/**
 * Hook for easy audit logging in detection components
 * 
 * Usage:
 * ```tsx
 * const { logDetection } = useAuditLog();
 * 
 * // After running detection
 * await logDetection({
 *   detection_type: 'image',
 *   media_type: file.type,
 *   file_name: file.name,
 *   file_size: file.size,
 *   detection_result: isDeepfake ? 'deepfake' : 'real',
 *   confidence_score: 0.95,
 *   processing_time_ms: 1234,
 *   metadata: {
 *     face_detected: true,
 *     model_version: '1.0.0'
 *   }
 * });
 * ```
 */
export const useAuditLog = () => {
  const { user } = useAuth();

  const logDetection = useCallback(
    async (data: Omit<AuditLogCreate, 'user_id'>) => {
      if (!user) {
        console.warn('Cannot log detection: user not authenticated');
        return null;
      }

      try {
        const result = await auditLogger.logDetection({
          ...data,
          user_id: user.id,
        });

        return result;
      } catch (error) {
        console.error('Failed to log detection:', error);
        return null;
      }
    },
    [user]
  );

  const getTimingHelper = useCallback(() => {
    const startTime = performance.now();

    return {
      getElapsedMs: () => Math.round(performance.now() - startTime),
    };
  }, []);

  return {
    logDetection,
    getTimingHelper,
    isAuthenticated: !!user,
  };
};
