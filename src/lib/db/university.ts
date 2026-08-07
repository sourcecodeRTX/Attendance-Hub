import { db } from './index';
import { Department, Branch, Specialisation, Section, User } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';

// --- Departments ---
export async function getDepartments(universityId: string): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('university_id', universityId);

  if (error) {
    return db.departments.where('universityId').equals(universityId).toArray();
  }

  const departments: Department[] = (data ?? []).map((row) => ({
    id: row.id,
    universityId: row.university_id,
    name: row.name,
    code: row.code,
    adminId: row.admin_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));

  await Promise.all(departments.map((dept) => db.departments.put(dept)));
  return departments;
}

export async function getDepartmentById(id: string): Promise<Department | undefined> {
  return db.departments.get(id);
}

export async function createDepartment(dept: Department, userId: string): Promise<void> {
  await db.departments.put(dept);
  await db.syncQueue.add({
    universityId: dept.universityId,
    ownerId: userId,
    type: 'create',
    collection: 'departments',
    docId: dept.id,
    data: {
      id: dept.id,
      university_id: dept.universityId,
      name: dept.name,
      code: dept.code,
      admin_id: dept.adminId,
      is_active: dept.isActive,
      created_at: dept.createdAt,
      created_by: dept.createdBy,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function updateDepartment(dept: Department, userId: string): Promise<void> {
  await db.departments.put(dept);
  await db.syncQueue.add({
    universityId: dept.universityId,
    ownerId: userId,
    type: 'update',
    collection: 'departments',
    docId: dept.id,
    data: {
      name: dept.name,
      code: dept.code,
      admin_id: dept.adminId,
      is_active: dept.isActive,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

// --- Branches ---
export async function getBranches(universityId: string, departmentId?: string): Promise<Branch[]> {
  if (departmentId) {
    return db.branches
      .where('universityId')
      .equals(universityId)
      .filter((b) => b.departmentId === departmentId)
      .toArray();
  }
  return db.branches.where('universityId').equals(universityId).toArray();
}

export async function createBranch(branch: Branch, userId: string): Promise<void> {
  await db.branches.put(branch);
  await db.syncQueue.add({
    universityId: branch.universityId,
    ownerId: userId,
    type: 'create',
    collection: 'branches',
    docId: branch.id,
    data: {
      id: branch.id,
      university_id: branch.universityId,
      department_id: branch.departmentId,
      name: branch.name,
      code: branch.code,
      is_active: branch.isActive,
      created_at: branch.createdAt,
      created_by: branch.createdBy,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function updateBranch(branch: Branch, userId: string): Promise<void> {
  await db.branches.put(branch);
  await db.syncQueue.add({
    universityId: branch.universityId,
    ownerId: userId,
    type: 'update',
    collection: 'branches',
    docId: branch.id,
    data: {
      name: branch.name,
      code: branch.code,
      is_active: branch.isActive,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

// --- Specialisations ---
export async function getSpecialisations(universityId: string, branchId?: string): Promise<Specialisation[]> {
  if (branchId) {
    return db.specialisations.where({ universityId, branchId }).toArray();
  }
  return db.specialisations.where('universityId').equals(universityId).toArray();
}

export async function createSpecialisation(spec: Specialisation, userId: string): Promise<void> {
  await db.specialisations.put(spec);
  await db.syncQueue.add({
    universityId: spec.universityId,
    ownerId: userId,
    type: 'create',
    collection: 'specialisations',
    docId: spec.id,
    data: {
      id: spec.id,
      university_id: spec.universityId,
      department_id: spec.departmentId,
      branch_id: spec.branchId,
      name: spec.name,
      code: spec.code,
      is_active: spec.isActive,
      created_at: spec.createdAt,
      created_by: spec.createdBy,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function updateSpecialisation(spec: Specialisation, userId: string): Promise<void> {
  await db.specialisations.put(spec);
  await db.syncQueue.add({
    universityId: spec.universityId,
    ownerId: userId,
    type: 'update',
    collection: 'specialisations',
    docId: spec.id,
    data: {
      name: spec.name,
      code: spec.code,
      branch_id: spec.branchId,
      is_active: spec.isActive,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function deactivateDepartmentAdmin(
  adminUser: User,
  dept: Department,
  replacementAdmin: {
    userId: string;
    fullName: string;
    staffId: string;
    email: string;
  },
  actorUserId: string
): Promise<void> {
  if (!replacementAdmin.userId) {
    throw new Error('Replacement Required');
  }

  await db.transaction('rw', [db.users, db.departments, db.syncQueue], async () => {
    const now = new Date().toISOString();

    const promotedUser: User = {
      id: replacementAdmin.userId,
      universityId: dept.universityId,
      role: 'admin',
      fullName: replacementAdmin.fullName,
      staffId: replacementAdmin.staffId,
      email: replacementAdmin.email,
      departmentId: dept.id,
      isActive: true,
      mustChangePassword: true,
      createdAt: now,
      createdBy: actorUserId,
    };

    await db.users.put(promotedUser);
    await db.departments.put({ ...dept, adminId: promotedUser.id });
    await db.users.put({ ...adminUser, isActive: false });

    await db.syncQueue.add({
      universityId: promotedUser.universityId,
      ownerId: actorUserId,
      type: 'create',
      collection: 'users',
      docId: promotedUser.id,
      data: {
        id: promotedUser.id,
        university_id: promotedUser.universityId,
        role: 'admin',
        full_name: promotedUser.fullName,
        staff_id: promotedUser.staffId,
        email: promotedUser.email,
        department_id: dept.id,
        is_active: true,
        must_change_password: true,
        created_at: promotedUser.createdAt,
        created_by: promotedUser.createdBy,
      },
      createdAt: now,
      retryCount: 0,
    });

    await db.syncQueue.add({
      universityId: dept.universityId,
      ownerId: actorUserId,
      type: 'update',
      collection: 'departments',
      docId: dept.id,
      data: { admin_id: promotedUser.id },
      createdAt: now,
      retryCount: 0,
    });

    await db.syncQueue.add({
      universityId: adminUser.universityId,
      ownerId: actorUserId,
      type: 'update',
      collection: 'users',
      docId: adminUser.id,
      data: { is_active: false },
      createdAt: now,
      retryCount: 0,
    });
  });
}

// --- Sections ---
export async function getSections(universityId: string, departmentId?: string): Promise<Section[]> {
  if (departmentId) {
    return db.sections
      .where('universityId')
      .equals(universityId)
      .filter((s) => s.departmentId === departmentId)
      .toArray();
  }
  return db.sections.where('universityId').equals(universityId).toArray();
}

export async function createSection(section: Section, userId: string): Promise<void> {
  await db.sections.put(section);
  await db.syncQueue.add({
    universityId: section.universityId,
    ownerId: userId,
    type: 'create',
    collection: 'sections',
    docId: section.id,
    data: {
      id: section.id,
      university_id: section.universityId,
      department_id: section.departmentId,
      branch_id: section.branchId,
      specialisation_id: section.specialisationId,
      name: section.name,
      primary_teacher_id: section.primaryTeacherId,
      is_active: section.isActive,
      is_archived: section.isArchived,
      created_at: section.createdAt,
      created_by: section.createdBy,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function deleteSection(sectionId: string, universityId: string, userId: string): Promise<void> {
  const subjects = await db.subjects.where({ universityId, sectionId }).toArray();
  const subjectIds = subjects.map(s => s.id);

  await db.transaction('rw', [db.sections, db.userSections, db.userSubjects, db.subjects, db.attendanceSessions, db.syncQueue], async () => {
    await db.userSections.where('sectionId').equals(sectionId).delete();
    await db.userSubjects.where('sectionId').equals(sectionId).delete();
    for (const sid of subjectIds) {
      await db.attendanceSessions.where('subjectId').equals(sid).delete();
    }
    await db.subjects.where('sectionId').equals(sectionId).delete();
    await db.sections.delete(sectionId);

    await db.syncQueue.add({
      universityId,
      ownerId: userId,
      type: 'delete',
      collection: 'sections',
      docId: sectionId,
      data: null,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
  });
}

export async function updateSection(section: Section, userId: string): Promise<void> {
  await db.sections.put(section);
  await db.syncQueue.add({
    universityId: section.universityId,
    ownerId: userId,
    type: 'update',
    collection: 'sections',
    docId: section.id,
    data: {
      name: section.name,
      primary_teacher_id: section.primaryTeacherId,
      is_active: section.isActive,
      is_archived: section.isArchived,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}
