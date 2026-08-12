import { db } from './index';
import { UserSection, UserSubject } from '@/lib/types';

// --- User Sections (primary_teacher + CR assignments) ---
export async function getUserSections(userId: string): Promise<UserSection[]> {
  return db.userSections.where('userId').equals(userId).toArray();
}

export async function getSectionUsers(sectionId: string): Promise<UserSection[]> {
  return db.userSections.where('sectionId').equals(sectionId).toArray();
}

export async function getPrimarySectionId(userId: string): Promise<string | null> {
  const primarySections = await db.sections.where('primaryTeacherId').equals(userId).toArray();
  if (primarySections.length > 0) return primarySections[0].id;
  
  const userSections = await getUserSections(userId);
  if (userSections.length > 0) return userSections[0].sectionId;
  return null;
}

export async function createUserSection(us: UserSection, currentUserId: string): Promise<void> {
  await db.userSections.put(us);
  await db.syncQueue.add({
    universityId: us.universityId,
    ownerId: currentUserId,
    type: 'create',
    collection: 'user_sections',
    docId: us.id,
    data: {
      id: us.id,
      university_id: us.universityId,
      user_id: us.userId,
      section_id: us.sectionId,
      user_role: us.userRole,
      assigned_at: us.assignedAt,
      assigned_by: us.assignedBy,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function deleteUserSectionsByUser(userId: string, universityId: string, currentUserId: string): Promise<void> {
  const entries = await db.userSections.where('userId').equals(userId).toArray();
  await db.transaction('rw', [db.userSections, db.syncQueue], async () => {
    for (const entry of entries) {
      await db.userSections.delete(entry.id);
      await db.syncQueue.add({
        universityId,
        ownerId: currentUserId,
        type: 'delete',
        collection: 'user_sections',
        docId: entry.id,
        data: null,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
    }
  });
}

// --- User Subjects (regular_teacher assignments) ---
export async function getUserSubjects(userId: string): Promise<UserSubject[]> {
  return db.userSubjects.where('userId').equals(userId).toArray();
}

export async function getSubjectTeachers(subjectId: string): Promise<UserSubject[]> {
  return db.userSubjects.where('subjectId').equals(subjectId).toArray();
}

export async function createUserSubject(us: UserSubject, currentUserId: string): Promise<void> {
  // Check if the combination already exists
  const existing = await db.userSubjects
    .where(['subjectId', 'sectionId'])
    .equals([us.subjectId, us.sectionId])
    .first();
  
  if (existing) {
    if (existing.userId === us.userId) return; // Already assigned to this user
    throw new Error('This subject-section combination is already assigned to another teacher.');
  }

  await db.userSubjects.put(us);
  await db.syncQueue.add({
    universityId: us.universityId,
    ownerId: currentUserId,
    type: 'create',
    collection: 'user_subjects',
    docId: us.id,
    data: {
      id: us.id,
      university_id: us.universityId,
      user_id: us.userId,
      subject_id: us.subjectId,
      section_id: us.sectionId,
      assigned_at: us.assignedAt,
      assigned_by: us.assignedBy,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function deleteUserSubjectsByUser(userId: string, universityId: string, currentUserId: string): Promise<void> {
  const entries = await db.userSubjects.where('userId').equals(userId).toArray();
  await db.transaction('rw', [db.userSubjects, db.syncQueue], async () => {
    for (const entry of entries) {
      await db.userSubjects.delete(entry.id);
      await db.syncQueue.add({
        universityId,
        ownerId: currentUserId,
        type: 'delete',
        collection: 'user_subjects',
        docId: entry.id,
        data: null,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
    }
  });
}

export async function deleteUserSubject(id: string, universityId: string, currentUserId: string): Promise<void> {
  await db.transaction('rw', [db.userSubjects, db.syncQueue], async () => {
    await db.userSubjects.delete(id);
    await db.syncQueue.add({
      universityId,
      ownerId: currentUserId,
      type: 'delete',
      collection: 'user_subjects',
      docId: id,
      data: null,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
  });
}

// --- Update User Role ---
export async function updateUserRole(
  userId: string, 
  universityId: string, 
  newRole: 'primary_teacher' | 'regular_teacher', 
  currentUserId: string
): Promise<void> {
  const user = await db.users.get(userId);
  if (!user) throw new Error('User not found');

  const updatedUser = { ...user, role: newRole };
  await db.users.put(updatedUser);
  
  await db.syncQueue.add({
    universityId,
    ownerId: currentUserId,
    type: 'update',
    collection: 'users',
    docId: userId,
    data: {
      role: newRole,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}
