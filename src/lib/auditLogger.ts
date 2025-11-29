import { supabase } from './supabase';
import { AuditLog, AuditLogCreate, AuditLogFilters, AuditLogStats } from '@/types';

/**
 * Audit Logger Service
 * 
 * Provides comprehensive audit logging for all deepfake detection operations.
 * Tracks when, where, and by whom detections are performed - useful for:
 * - Legal compliance
 * - Journalistic workflows
 * - Security audits
 * - Usage analytics
 */

class AuditLoggerService {
  private sessionId: string;

  constructor() {
    // Generate a unique session ID for this browser session
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate a unique session identifier
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client IP address (best effort - may not work with all setups)
   */
  private async getClientIP(): Promise<string | undefined> {
    try {
      // In production, you might want to use a service or server endpoint
      // For now, we'll return undefined and handle this server-side
      return undefined;
    } catch (error) {
      console.warn('Could not fetch IP address:', error);
      return undefined;
    }
  }

  /**
   * Get user agent string
   */
  private getUserAgent(): string {
    return navigator.userAgent;
  }

  /**
   * Log a detection operation
   */
  async logDetection(data: AuditLogCreate): Promise<AuditLog | null> {
    try {
      const logEntry = {
        ...data,
        session_id: this.sessionId,
        user_agent: this.getUserAgent(),
        ip_address: await this.getClientIP(),
        created_at: new Date().toISOString(),
      };

      const { data: insertedLog, error } = await supabase
        .from('audit_logs')
        .insert([logEntry])
        .select()
        .single();

      if (error) {
        console.error('Failed to create audit log:', error);
        return null;
      }

      return insertedLog as AuditLog;
    } catch (error) {
      console.error('Error logging detection:', error);
      return null;
    }
  }

  /**
   * Get audit logs with optional filters
   */
  async getLogs(filters?: AuditLogFilters, limit: number = 50): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters?.detection_type) {
        query = query.eq('detection_type', filters.detection_type);
      }
      if (filters?.detection_result) {
        query = query.eq('detection_result', filters.detection_result);
      }
      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('created_at', filters.end_date);
      }
      if (filters?.min_confidence !== undefined) {
        query = query.gte('confidence_score', filters.min_confidence);
      }
      if (filters?.max_confidence !== undefined) {
        query = query.lte('confidence_score', filters.max_confidence);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
      }

      return (data as AuditLog[]) || [];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Get a single audit log by ID
   */
  async getLogById(id: string): Promise<AuditLog | null> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Failed to fetch audit log:', error);
        return null;
      }

      return data as AuditLog;
    } catch (error) {
      console.error('Error fetching audit log:', error);
      return null;
    }
  }

  /**
   * Get audit log statistics
   */
  async getStats(userId?: string, startDate?: string, endDate?: string): Promise<AuditLogStats | null> {
    try {
      let query = supabase.from('audit_logs').select('*');

      if (userId) {
        query = query.eq('user_id', userId);
      }
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch audit log stats:', error);
        return null;
      }

      const logs = data as AuditLog[];

      // Calculate statistics
      const stats: AuditLogStats = {
        total_detections: logs.length,
        deepfake_count: logs.filter(l => l.detection_result === 'deepfake').length,
        real_count: logs.filter(l => l.detection_result === 'real').length,
        uncertain_count: logs.filter(l => l.detection_result === 'uncertain').length,
        avg_confidence: logs.reduce((sum, l) => sum + l.confidence_score, 0) / logs.length || 0,
        avg_processing_time: logs.reduce((sum, l) => sum + l.processing_time_ms, 0) / logs.length || 0,
        detection_by_type: {
          image: logs.filter(l => l.detection_type === 'image').length,
          video: logs.filter(l => l.detection_type === 'video').length,
          webcam: logs.filter(l => l.detection_type === 'webcam').length,
        },
      };

      return stats;
    } catch (error) {
      console.error('Error calculating audit log stats:', error);
      return null;
    }
  }

  /**
   * Delete audit logs older than specified days
   * (For GDPR/data retention compliance)
   */
  async deleteOldLogs(daysOld: number): Promise<boolean> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        console.error('Failed to delete old audit logs:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting old audit logs:', error);
      return false;
    }
  }

  /**
   * Export audit logs to CSV format
   */
  async exportToCSV(filters?: AuditLogFilters): Promise<string> {
    try {
      const logs = await this.getLogs(filters, 10000); // Get more logs for export

      // CSV headers
      const headers = [
        'ID',
        'User ID',
        'Detection Type',
        'Media Type',
        'File Name',
        'File Size (bytes)',
        'Result',
        'Confidence Score',
        'Processing Time (ms)',
        'IP Address',
        'Session ID',
        'Created At',
      ];

      // Convert logs to CSV rows
      const rows = logs.map(log => [
        log.id,
        log.user_id,
        log.detection_type,
        log.media_type,
        log.file_name || '',
        log.file_size?.toString() || '',
        log.detection_result,
        log.confidence_score.toFixed(2),
        log.processing_time_ms.toString(),
        log.ip_address || '',
        log.session_id || '',
        log.created_at,
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      return csvContent;
    } catch (error) {
      console.error('Error exporting audit logs to CSV:', error);
      return '';
    }
  }

  /**
   * Download audit logs as CSV file
   */
  async downloadLogsAsCSV(filters?: AuditLogFilters, filename: string = 'audit_logs.csv'): Promise<void> {
    const csvContent = await this.exportToCSV(filters);
    
    if (!csvContent) {
      console.error('No data to export');
      return;
    }

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Export a singleton instance
export const auditLogger = new AuditLoggerService();

// Export the class for testing or custom instances
export { AuditLoggerService };
