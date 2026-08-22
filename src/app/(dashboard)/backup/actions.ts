'use server';

import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUniversitySuperAdmin } from '@/lib/supabase/server-auth';

// Tables a bulk upsert is allowed to touch. Anything else is rejected
// instead of being passed to the service-role client as an arbitrary
// table name.
const ALLOWED_BULK_COLLECTIONS = new Set([
  'departments',
  'branches',
  'specialisations',
  'sections',
  'users',
  'students',
  'subjects',
  'subject_sections',
  'user_sections',
  'user_subjects',
  'attendance_sessions',
]);

interface RestoredCredential {
  email: string;
  fullName: string;
  temporaryPassword: string;
}

function generateOneTimePassword(): string {
  return randomBytes(12).toString('base64url');
}

export async function wipeUniversityData(universityId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const guard = await requireUniversitySuperAdmin(universityId);
    if (!guard.ok) throw new Error(guard.error);
    const currentUserId = guard.userId;

    const adminClient = createAdminClient();

    const { error: attErr } = await adminClient.from('attendance_sessions').delete().eq('university_id', universityId);
    if (attErr) throw attErr;

    const { error: usSubErr } = await adminClient.from('user_subjects').delete().eq('university_id', universityId);
    if (usSubErr) throw usSubErr;

    const { error: usSecErr } = await adminClient.from('user_sections').delete().eq('university_id', universityId);
    if (usSecErr) throw usSecErr;

    const { error: stuErr } = await adminClient.from('students').delete().eq('university_id', universityId);
    if (stuErr) throw stuErr;

    const { data: subjects } = await adminClient.from('subjects').select('id').eq('university_id', universityId);
    if (subjects && subjects.length > 0) {
      const subjectIds = subjects.map(s => s.id);
      await adminClient.from('subject_sections').delete().in('subject_id', subjectIds);
    }
    const { error: subErr } = await adminClient.from('subjects').delete().eq('university_id', universityId);
    if (subErr) throw subErr;

    const { error: secErr } = await adminClient.from('sections').delete().eq('university_id', universityId);
    if (secErr) throw secErr;

    const { error: specErr } = await adminClient.from('specialisations').delete().eq('university_id', universityId);
    if (specErr) throw specErr;

    const { error: branchErr } = await adminClient.from('branches').delete().eq('university_id', universityId);
    if (branchErr) throw branchErr;

    const { error: deptErr } = await adminClient.from('departments').delete().eq('university_id', universityId);
    if (deptErr) throw deptErr;

    // 10. Delete users (except current user) from both auth and public
    const { data: usersToDelete } = await adminClient
      .from('users')
      .select('id')
      .eq('university_id', universityId)
      .neq('id', currentUserId);

    if (usersToDelete && usersToDelete.length > 0) {
      for (const u of usersToDelete) {
        await adminClient.auth.admin.deleteUser(u.id);
      }
    }

    const { error: userErr } = await adminClient.from('users').delete().eq('university_id', universityId).neq('id', currentUserId);
    if (userErr) throw userErr;

    return { success: true };
  } catch (error: any) {
    console.error('Failed to wipe university data:', error);
    return { success: false, error: error.message };
  }
}

// Internal helper for restoreUniversityData — intentionally NOT exported so it
// is not reachable as a public server action.
async function restoreAuthUsers(
  users: any[],
  universityId: string,
  currentUserId: string
): Promise<{
  success: boolean;
  error?: string;
  idMapping?: Record<string, string>;
  createdUserIds?: string[];
  credentials?: RestoredCredential[];
}> {
  try {
    const adminClient = createAdminClient();
    const idMapping: Record<string, string> = {};
    const createdUserIds: string[] = [];
    const credentials: RestoredCredential[] = [];

    // Only match against profiles that already belong to THIS university.
    // Never match against auth users project-wide — that would silently
    // remap identities across universities.
    const { data: existingPublicUsers, error: fetchError } = await adminClient
      .from('users')
      .select('id, email, staff_id')
      .eq('university_id', universityId);
    if (fetchError) {
      throw new Error(`Failed to look up existing users: ${fetchError.message}`);
    }

    for (const u of users) {
      if (u.role === 'super_admin') continue;

      let existing = existingPublicUsers?.find(
        (x: any) => x.email && u.email && x.email.toLowerCase() === String(u.email).toLowerCase()
      );
      if (!existing && u.staffId) {
        existing = existingPublicUsers?.find((x: any) => x.staff_id && x.staff_id === u.staffId);
      }

      if (existing) {
        if (existing.id === currentUserId) {
          throw new Error(`User "${u.fullName || u.email}" uses the same email as the Super Admin (${u.email}). This is not allowed as it would corrupt the super admin account. Please correct their email locally before backup.`);
        }
        if (existing.id !== u.id) {
          idMapping[u.id] = existing.id;
          u.id = existing.id;
        }
        continue;
      }

      const temporaryPassword = generateOneTimePassword();
      const { data, error } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { role: u.role }
      });

      if (!data?.user) {
        throw new Error(`Failed to create auth user ${u.email}: ${error?.message}`);
      }

      if (data.user.id !== u.id) {
        idMapping[u.id] = data.user.id;
        u.id = data.user.id;
      }
      createdUserIds.push(data.user.id);
      credentials.push({
        email: u.email,
        fullName: u.fullName || u.email,
        temporaryPassword,
      });
    }
    return { success: true, idMapping, createdUserIds, credentials };
  } catch (error: any) {
    console.error('Failed to restore auth users:', error);
    return { success: false, error: error.message };
  }
}

export async function adminBulkUpsert(collection: string, payload: any[], universityId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ALLOWED_BULK_COLLECTIONS.has(collection)) {
      throw new Error(`Invalid collection: ${collection}`);
    }

    const guard = await requireUniversitySuperAdmin(universityId);
    if (!guard.ok) throw new Error(guard.error);

    const adminClient = createAdminClient();

    // Force university_id on all payload items for security, except for tables that don't use it directly
    // subject_sections doesn't have university_id.
    const tablesWithoutUniId = ['subject_sections'];

    const safePayload = payload.map(item => {
      if (tablesWithoutUniId.includes(collection)) {
        return item;
      }
      return { ...item, university_id: universityId };
    });

    const { error } = await adminClient.from(collection).upsert(safePayload);
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error(`adminBulkUpsert failed for ${collection}:`, error);
    return { success: false, error: error.message };
  }
}

export async function restoreUniversityData(
  universityId: string,
  settings: any,
  data: any
): Promise<{ success: boolean; error?: string; credentials?: RestoredCredential[] }> {
  try {
    const guard = await requireUniversitySuperAdmin(universityId);
    if (!guard.ok) throw new Error(guard.error);
    const currentUserId = guard.userId;

    const adminClient = createAdminClient();

    const filterByUni = (arr: any[]) => {
      return (arr || []).filter(item => !item.universityId || item.universityId === universityId);
    };

    settings.users = filterByUni(settings.users);

    // Deduplicate departments by code to prevent React duplicate key warnings
    // Check for duplicate departments by code
    const uniqueDeptsMap = new Map();
    for (const d of filterByUni(settings.departments)) {
      if (uniqueDeptsMap.has(d.code)) {
        throw new Error(`Duplicate department code found in backup: "${d.code}". Please remove or fix the duplicate department in the settings JSON file before importing.`);
      }
      uniqueDeptsMap.set(d.code, d);
    }
    settings.departments = Array.from(uniqueDeptsMap.values());

    settings.branches = filterByUni(settings.branches);
    settings.specialisations = filterByUni(settings.specialisations);
    settings.sections = filterByUni(settings.sections);
    settings.subjects = filterByUni(settings.subjects);

    // Check for duplicate students by sectionId and rollNumber
    const uniqueStudentsMap = new Map();
    for (const s of filterByUni(data.students)) {
      const key = `${s.sectionId}-${s.rollNumber}`;
      if (uniqueStudentsMap.has(key)) {
        throw new Error(`Duplicate student roll number found in backup data: Roll Number "${s.rollNumber}" in Section ID "${s.sectionId}". Please remove the duplicate student from the data JSON file before importing.`);
      }
      uniqueStudentsMap.set(key, s);
    }
    data.students = Array.from(uniqueStudentsMap.values());

    // subject_sections don't have universityId, so filter them based on valid subjectIds
    const validSubjectIds = new Set(settings.subjects.map((s: any) => s.id));
    data.subjectSections = (data.subjectSections || []).filter((ss: any) => validSubjectIds.has(ss.subjectId));

    data.userSections = filterByUni(data.userSections);
    data.userSubjects = filterByUni(data.userSubjects);
    data.attendanceSessions = filterByUni(data.attendanceSessions);

    // 2. Deduplicate users from backup payload first
    const rawUsers = settings.users || [];
    const uniqueUsersMap = new Map();
    const safeUsersToRestore = [];
    const duplicateIdMapping: Record<string, string> = {};

    for (const u of rawUsers) {
      const key = u.staffId || u.email;
      if (key && uniqueUsersMap.has(key)) {
         const kept = uniqueUsersMap.get(key);
         duplicateIdMapping[u.id] = kept.id;
      } else {
         if (key) uniqueUsersMap.set(key, u);
         safeUsersToRestore.push(u);
      }
    }
    settings.users = safeUsersToRestore;

    // 2. Restore auth users and remap IDs
    const restoreRes = await restoreAuthUsers(safeUsersToRestore, universityId, currentUserId);
    if (!restoreRes.success) {
      throw new Error(restoreRes.error || 'Failed to restore auth users');
    }

    const mapping: Record<string, string> = { ...(restoreRes.idMapping || {}) };

    // Resolve duplicates so relations point to the kept user
    for (const [dupId, keptId] of Object.entries(duplicateIdMapping)) {
       mapping[dupId] = mapping[keptId] || keptId;
    }
    const replaceIds = (obj: any) => {
      if (!obj) return;
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          if (typeof obj[i] === 'string' && mapping[obj[i]]) {
            obj[i] = mapping[obj[i]];
          } else if (typeof obj[i] === 'object') {
            replaceIds(obj[i]);
          }
        }
      } else if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'string' && mapping[obj[key]]) {
            obj[key] = mapping[obj[key]];
          } else if (typeof obj[key] === 'object') {
            replaceIds(obj[key]);
          }
        }
      }
    };

    if (Object.keys(mapping).length > 0) {
      replaceIds(settings);
      replaceIds(data);
    }

    // Prepare helper to map rows
    const mapRemoteToLocalFormat = (collection: string, row: any) => {
      const base: any = { id: row.id };
      switch (collection) {
        case 'departments':
          return { ...base, university_id: row.universityId, name: row.name, code: row.code, admin_id: row.adminId, is_active: row.isActive, created_at: row.createdAt, created_by: row.createdBy };
        case 'branches':
          return { ...base, university_id: row.universityId, department_id: row.departmentId, name: row.name, code: row.code, is_active: row.isActive, created_at: row.createdAt, created_by: row.createdBy };
        case 'specialisations':
          return { ...base, university_id: row.universityId, department_id: row.departmentId, branch_id: row.branchId, name: row.name, code: row.code, is_active: row.isActive, created_at: row.createdAt, created_by: row.createdBy };
        case 'sections':
          return { ...base, university_id: row.universityId, department_id: row.departmentId, branch_id: row.branchId, specialisation_id: row.specialisationId, name: row.name, primary_teacher_id: row.primaryTeacherId, is_active: row.isActive, is_archived: row.isArchived, created_at: row.createdAt, created_by: row.createdBy };
        case 'users':
          return { ...base, university_id: row.universityId, role: row.role, full_name: row.fullName, staff_id: row.staffId || null, email: row.email, department_id: row.departmentId, is_active: row.isActive, must_change_password: row.mustChangePassword, created_at: row.createdAt, created_by: row.createdBy };
        case 'students':
          return { ...base, university_id: row.universityId, department_id: row.departmentId, branch_id: row.branchId, specialisation_id: row.specialisationId, section_id: row.sectionId, roll_number: row.rollNumber, full_name: row.fullName, is_active: row.isActive, uploaded_at: row.uploadedAt, uploaded_by: row.uploadedBy };
        case 'subjects':
          return { ...base, university_id: row.universityId, department_id: row.departmentId, name: row.name, code: row.code, created_at: row.createdAt, created_by: row.createdBy };
        case 'subject_sections':
          return { ...base, subject_id: row.subjectId, section_id: row.sectionId, created_at: row.createdAt, created_by: row.createdBy };
        case 'user_sections':
          return { ...base, university_id: row.universityId, user_id: row.userId, section_id: row.sectionId, user_role: row.userRole, assigned_at: row.assignedAt, assigned_by: row.assignedBy };
        case 'user_subjects':
          return { ...base, university_id: row.universityId, user_id: row.userId, subject_id: row.subjectId, section_id: row.sectionId, assigned_at: row.assignedAt, assigned_by: row.assignedBy };
        case 'attendance_sessions':
          return { ...base, university_id: row.universityId, department_id: row.departmentId, section_id: row.sectionId, subject_id: row.subjectId, date: row.date, period_number: row.periodNumber, period_label: row.periodLabel, records: row.records, locked_by_teacher: row.lockedByTeacher, is_archived: row.isArchived, created_by: row.createdBy, last_modified_by: row.lastModifiedBy, created_at: row.createdAt };
        default:
          return row;
      }
    };

    // Prepare mapped payloads
    const mappedUsers = (settings.users || []).filter((u: any) => u.role !== 'super_admin').map((r: any) => mapRemoteToLocalFormat('users', r));
    const mappedDepartments = (settings.departments || []).map((r: any) => mapRemoteToLocalFormat('departments', r));
    const mappedBranches = (settings.branches || []).map((r: any) => mapRemoteToLocalFormat('branches', r));
    const mappedSpecialisations = (settings.specialisations || []).map((r: any) => mapRemoteToLocalFormat('specialisations', r));
    const mappedSections = (settings.sections || []).map((r: any) => mapRemoteToLocalFormat('sections', r));
    const mappedSubjects = (settings.subjects || []).map((r: any) => mapRemoteToLocalFormat('subjects', r));
    const mappedStudents = (data.students || []).map((r: any) => mapRemoteToLocalFormat('students', r));
    const mappedSubjectSections = (data.subjectSections || []).map((r: any) => mapRemoteToLocalFormat('subject_sections', r));
    const mappedUserSections = (data.userSections || []).map((r: any) => mapRemoteToLocalFormat('user_sections', r));
    const mappedUserSubjects = (data.userSubjects || []).map((r: any) => mapRemoteToLocalFormat('user_subjects', r));
    const mappedAttendance = (data.attendanceSessions || []).map((r: any) => mapRemoteToLocalFormat('attendance_sessions', r));

    // Force university_id for security
    const forceUniversityId = (payload: any[], skip?: boolean) => {
      if (skip) return payload;
      return payload.map(item => ({ ...item, university_id: universityId }));
    };

    // Helper for upserting
    const doUpsert = async (collection: string, payload: any[], skipUniId: boolean = false) => {
      if (!payload || payload.length === 0) return;
      const safePayload = forceUniversityId(payload, skipUniId);
      const { error } = await adminClient.from(collection).upsert(safePayload);
      if (error) {
         console.error(`Failed to upsert ${collection}:`, error);
         throw new Error(`Failed to restore ${collection}: ${error.message}`);
      }
    };

    // Deduplicate mappedUsers by ID. This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time"
    // which happens if multiple original users map to the same existing auth user ID.
    const uniqueMappedUsers = new Map();
    for (const u of mappedUsers) {
      if (u.id) uniqueMappedUsers.set(u.id, u);
    }
    // Accounts freshly created by this restore received a random one-time
    // password nobody knows; force a password change at first login.
    const createdIdSet = new Set(restoreRes.createdUserIds || []);
    const finalMappedUsers = Array.from(uniqueMappedUsers.values()).map(u =>
      createdIdSet.has(u.id) ? { ...u, must_change_password: true } : u
    );

    // Break circular dependency: Users <-> Departments
    // Step 1: Upsert users with department_id = NULL
    if (finalMappedUsers.length > 0) {
      const usersWithoutDepts = finalMappedUsers.map((u: any) => ({ ...u, department_id: null }));
      await doUpsert('users', usersWithoutDepts);
    }

    // Step 2: Upsert departments (now safe because users exist for admin_id)
    await doUpsert('departments', mappedDepartments);

    // Step 3: Upsert users again with actual department_id
    if (finalMappedUsers.length > 0) {
      await doUpsert('users', finalMappedUsers);
    }

    // Continue with other tables in safe dependency order
    await doUpsert('branches', mappedBranches);
    await doUpsert('specialisations', mappedSpecialisations);

    // Sections have primary_teacher_id which relies on users
    await doUpsert('sections', mappedSections);
    await doUpsert('subjects', mappedSubjects);
    await doUpsert('students', mappedStudents);

    // Many-to-many junction tables and attendance
    await doUpsert('subject_sections', mappedSubjectSections, true);
    await doUpsert('user_sections', mappedUserSections);
    await doUpsert('user_subjects', mappedUserSubjects);
    await doUpsert('attendance_sessions', mappedAttendance);

    return { success: true, credentials: restoreRes.credentials || [] };
  } catch (error: any) {
    console.error('restoreUniversityData failed:', error);
    return { success: false, error: error.message };
  }
}
