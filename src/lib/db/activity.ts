import { createClient } from '@/lib/supabase/client';
import { ActivityActionType, ActivityLog, LogSettings } from '@/lib/types';
import { UserRole } from '@/lib/types';

// Storage key for tracking last cleanup timestamp per university (kept for backward compatibility)
const CLEANUP_STORAGE_KEY_PREFIX = 'activity_logs_last_cleanup_';

interface LogActivityInput {
  universityId: string;
  departmentId?: string | null;
  actionType: ActivityActionType;
  performedByRole: UserRole;
  performedByName: string;
  performedById: string;
  targetName?: string | null;
  sectionName?: string | null;
  branchName?: string | null;
  departmentName?: string | null;
  details?: Record<string, unknown> | null;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from('activity_logs').insert({
      university_id: input.universityId,
      department_id: input.departmentId || null,
      action_type: input.actionType,
      performed_by_role: input.performedByRole,
      performed_by_name: input.performedByName,
      performed_by_id: input.performedById,
      target_name: input.targetName || null,
      section_name: input.sectionName || null,
      branch_name: input.branchName || null,
      department_name: input.departmentName || null,
      details: input.details || null,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function getActivityLogs(
  universityId: string,
  options?: {
    departmentId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ActivityLog[]> {
  const supabase = createClient();
  
  // Join with departments table to get the department name dynamically
  // This ensures we always display current department names even if
  // the denormalized department_name field is null
  let query = supabase
    .from('activity_logs')
    .select(`
      *,
      departments:department_id (
        name
      )
    `)
    .eq('university_id', universityId)
    .order('created_at', { ascending: false });

  if (options?.departmentId) {
    query = query.eq('department_id', options.departmentId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options?.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    universityId: row.university_id,
    departmentId: row.department_id,
    actionType: row.action_type,
    performedByRole: row.performed_by_role,
    performedByName: row.performed_by_name,
    performedById: row.performed_by_id,
    targetName: row.target_name,
    sectionName: row.section_name,
    branchName: row.branch_name,
    // Use joined department name, fall back to stored department_name if department was deleted
    departmentName: row.departments?.name ?? row.department_name,
    details: row.details,
    createdAt: row.created_at,
  }));
}

/**
 * Get the start of the current week (Monday 00:00:00 UTC)
 */
export function getStartOfCurrentWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  // Convert Sunday (0) to 7 so Monday becomes day 1
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);
  
  return monday;
}

/**
 * Check if cleanup was already run this week for a university
 */
export function wasCleanupRunThisWeek(universityId: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const storageKey = `${CLEANUP_STORAGE_KEY_PREFIX}${universityId}`;
  const lastCleanup = localStorage.getItem(storageKey);
  
  if (!lastCleanup) return false;
  
  const lastCleanupDate = new Date(lastCleanup);
  const startOfWeek = getStartOfCurrentWeek();
  
  return lastCleanupDate >= startOfWeek;
}

/**
 * Record that cleanup was run for a university
 */
export function recordCleanupRun(universityId: string): void {
  if (typeof window === 'undefined') return;
  
  const storageKey = `${CLEANUP_STORAGE_KEY_PREFIX}${universityId}`;
  localStorage.setItem(storageKey, new Date().toISOString());
}

/**
 * Get the last cleanup timestamp for a university
 */
export function getLastCleanupTime(universityId: string): Date | null {
  if (typeof window === 'undefined') return null;
  
  const storageKey = `${CLEANUP_STORAGE_KEY_PREFIX}${universityId}`;
  const lastCleanup = localStorage.getItem(storageKey);
  
  return lastCleanup ? new Date(lastCleanup) : null;
}

interface DeleteOldLogsResult {
  success: boolean;
  deletedCount: number;
  error?: string;
  alreadyRunThisWeek?: boolean;
}

/**
 * @deprecated Use deleteLogsByAge instead. Kept for backward compatibility.
 * Delete activity logs older than the start of the current week (Monday 00:00 UTC).
 * Only super_admin should call this function.
 * Will skip if cleanup was already run this week.
 */
export async function deleteOldActivityLogs(
  universityId: string,
  options?: { force?: boolean }
): Promise<DeleteOldLogsResult> {
  // Check if cleanup was already run this week (unless forced)
  if (!options?.force && wasCleanupRunThisWeek(universityId)) {
    return {
      success: true,
      deletedCount: 0,
      alreadyRunThisWeek: true,
    };
  }

  const supabase = createClient();
  const startOfWeek = getStartOfCurrentWeek();

  try {
    // First, count how many logs will be deleted
    const { count, error: countError } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('university_id', universityId)
      .lt('created_at', startOfWeek.toISOString());

    if (countError) {
      throw countError;
    }

    // Delete old logs
    const { error: deleteError } = await supabase
      .from('activity_logs')
      .delete()
      .eq('university_id', universityId)
      .lt('created_at', startOfWeek.toISOString());

    if (deleteError) {
      throw deleteError;
    }

    // Record the cleanup run
    recordCleanupRun(universityId);

    return {
      success: true,
      deletedCount: count || 0,
    };
  } catch (error) {
    console.error('Failed to delete old activity logs:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ============================================
// LOG SETTINGS FUNCTIONS
// ============================================

/**
 * Get log settings for a university. Returns null if no settings exist yet.
 */
export async function getLogSettings(universityId: string): Promise<LogSettings | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('log_settings')
    .select('*')
    .eq('university_id', universityId)
    .maybeSingle();
  
  if (error) {
    // Handle table doesn't exist or permission errors gracefully
    if (error.code === '42P01' || error.code === 'PGRST204') {
      console.warn('log_settings table not available');
      return null;
    }
    console.error('Failed to get log settings:', error);
    return null;
  }
  
  // No settings exist yet
  if (!data) {
    return null;
  }
  
  return {
    id: data.id,
    universityId: data.university_id,
    autoDeleteEnabled: data.auto_delete_enabled,
    retentionDays: data.retention_days,
    lastAutoCleanupAt: data.last_auto_cleanup_at,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

interface SaveLogSettingsInput {
  universityId: string;
  autoDeleteEnabled: boolean;
  retentionDays: number | null;
  updatedBy: string;
}

/**
 * Save log settings for a university (creates or updates).
 */
export async function saveLogSettings(input: SaveLogSettingsInput): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  
  try {
    const { error } = await supabase
      .from('log_settings')
      .upsert({
        university_id: input.universityId,
        auto_delete_enabled: input.autoDeleteEnabled,
        retention_days: input.retentionDays,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      }, {
        onConflict: 'university_id',
      });
    
    if (error) {
      // Handle 406 or table not found errors
      if (error.code === '42P01' || error.message?.includes('406')) {
        return {
          success: false,
          error: 'Log settings feature not available. Migration may need to be applied.',
        };
      }
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save log settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ============================================
// FLEXIBLE LOG DELETION FUNCTIONS
// ============================================

export type DeleteLogsTimeframe = 'all' | '7days' | '14days' | '30days' | '60days' | '90days';

interface DeleteLogsResult {
  success: boolean;
  deletedCount: number;
  error?: string;
}

/**
 * Get the cutoff date for a given timeframe
 */
function getCutoffDate(timeframe: Exclude<DeleteLogsTimeframe, 'all'>): Date {
  const now = new Date();
  const days = {
    '7days': 7,
    '14days': 14,
    '30days': 30,
    '60days': 60,
    '90days': 90,
  }[timeframe];
  
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  
  return cutoff;
}

/**
 * Count logs that would be deleted for a given timeframe
 */
export async function countLogsToDelete(
  universityId: string,
  timeframe: DeleteLogsTimeframe
): Promise<number> {
  const supabase = createClient();
  
  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .eq('university_id', universityId);
  
  if (timeframe !== 'all') {
    const cutoff = getCutoffDate(timeframe);
    query = query.lt('created_at', cutoff.toISOString());
  }
  
  const { count, error } = await query;
  
  if (error) {
    console.error('Failed to count logs:', error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Delete logs by timeframe. Only super_admin should call this.
 * @param universityId - The university ID
 * @param timeframe - 'all' | '7days' | '14days' | '30days' | '60days' | '90days'
 */
export async function deleteLogsByAge(
  universityId: string,
  timeframe: DeleteLogsTimeframe
): Promise<DeleteLogsResult> {
  const supabase = createClient();
  
  try {
    // First count how many will be deleted
    const count = await countLogsToDelete(universityId, timeframe);
    
    // Build delete query
    let query = supabase
      .from('activity_logs')
      .delete()
      .eq('university_id', universityId);
    
    if (timeframe !== 'all') {
      const cutoff = getCutoffDate(timeframe);
      query = query.lt('created_at', cutoff.toISOString());
    }
    
    const { error } = await query;
    
    if (error) throw error;
    
    return {
      success: true,
      deletedCount: count,
    };
  } catch (error) {
    console.error('Failed to delete logs:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete logs older than a specific number of days
 */
export async function deleteLogsOlderThanDays(
  universityId: string,
  days: number
): Promise<DeleteLogsResult> {
  const supabase = createClient();
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  
  try {
    // First count how many will be deleted
    const { count, error: countError } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('university_id', universityId)
      .lt('created_at', cutoff.toISOString());
    
    if (countError) throw countError;
    
    // Delete
    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .eq('university_id', universityId)
      .lt('created_at', cutoff.toISOString());
    
    if (error) throw error;
    
    return {
      success: true,
      deletedCount: count || 0,
    };
  } catch (error) {
    console.error('Failed to delete logs:', error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Run auto-cleanup based on log settings (if enabled).
 * Should be called when super_admin visits the logs page.
 */
export async function runAutoCleanupIfEnabled(
  universityId: string
): Promise<DeleteLogsResult | null> {
  const settings = await getLogSettings(universityId);
  
  // If no settings or auto-delete is disabled, do nothing
  if (!settings || !settings.autoDeleteEnabled || !settings.retentionDays) {
    return null;
  }
  
  // Check if we already ran cleanup today
  if (settings.lastAutoCleanupAt) {
    const lastRun = new Date(settings.lastAutoCleanupAt);
    const now = new Date();
    // If last run was today, skip
    if (lastRun.toDateString() === now.toDateString()) {
      return null;
    }
  }
  
  // Run cleanup
  const result = await deleteLogsOlderThanDays(universityId, settings.retentionDays);
  
  // Update last cleanup timestamp
  if (result.success) {
    const supabase = createClient();
    await supabase
      .from('log_settings')
      .update({ last_auto_cleanup_at: new Date().toISOString() })
      .eq('university_id', universityId);
  }
  
  return result;
}
