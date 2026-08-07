-- Function to get next period number for a subject on a date
CREATE OR REPLACE FUNCTION get_next_period_number(
  p_subject_id uuid,
  p_date date
)
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(MAX(period_number), 0) + 1
  FROM attendance_sessions
  WHERE subject_id = p_subject_id AND date = p_date
$$;

-- Function to get user's university_id (used in RLS)
CREATE OR REPLACE FUNCTION auth_user_university_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT university_id FROM users WHERE id = auth.uid()
$$;
