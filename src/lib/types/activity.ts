import { UserRole } from './user';

export type ActivityActionType =
  | 'account_created'
  | 'account_deactivated'
  | 'account_deleted'
  | 'password_reset'
  | 'students_uploaded'
  | 'student_edited'
  | 'student_reassigned'
  | 'attendance_marked'
  | 'attendance_edited'
  | 'attendance_archived'
  | 'section_created'
  | 'section_deleted'
  | 'subject_created'
  | 'subject_deleted'
  | 'subject_updated'
  | 'teacher_subjects_assigned'
  | 'teacher_subject_removed'
  | 'teacher_assigned'
  | 'regular_teacher_assigned'
  | 'cr_assigned'
  | 'cr_deleted'
  | 'admin_reassigned'
  | 'teacher_role_changed';

export interface ActivityLog {
  id: string;
  universityId: string;
  departmentId: string | null;
  actionType: ActivityActionType;
  performedByRole: UserRole;
  performedByName: string;
  performedById: string;
  targetName: string | null;
  sectionName: string | null;
  branchName: string | null;
  departmentName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
