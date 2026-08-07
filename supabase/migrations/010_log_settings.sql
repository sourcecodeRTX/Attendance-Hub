-- ============================================
-- LOG SETTINGS TABLE
-- Stores per-university log retention settings
-- ============================================

CREATE TABLE IF NOT EXISTS log_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id         uuid NOT NULL UNIQUE REFERENCES universities(id) ON DELETE CASCADE,
  auto_delete_enabled   boolean NOT NULL DEFAULT false,
  retention_days        integer DEFAULT NULL,  -- NULL means no auto-delete; values: 7, 14, 30, 60, 90, etc.
  last_auto_cleanup_at  timestamptz DEFAULT NULL,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Index for quick lookup by university
CREATE INDEX IF NOT EXISTS idx_log_settings_university ON log_settings(university_id);

-- Enable RLS
ALTER TABLE log_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read their university's log settings
CREATE POLICY "super_admin_read_log_settings" ON log_settings
  FOR SELECT USING (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'super_admin'
  );

-- Only super_admin can insert log settings for their university
CREATE POLICY "super_admin_insert_log_settings" ON log_settings
  FOR INSERT WITH CHECK (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'super_admin'
  );

-- Only super_admin can update their university's log settings
CREATE POLICY "super_admin_update_log_settings" ON log_settings
  FOR UPDATE USING (
    university_id = public.get_my_university_id()
    AND public.get_my_role() = 'super_admin'
  );

-- Comment for documentation
COMMENT ON TABLE log_settings IS 'Per-university log retention and auto-deletion settings. Only super_admin can manage.';
COMMENT ON COLUMN log_settings.auto_delete_enabled IS 'If true, logs older than retention_days will be automatically deleted';
COMMENT ON COLUMN log_settings.retention_days IS 'Number of days to retain logs. NULL means keep forever.';
COMMENT ON COLUMN log_settings.last_auto_cleanup_at IS 'Timestamp of last automatic cleanup run';
