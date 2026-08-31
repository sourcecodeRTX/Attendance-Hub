import { db } from './index';
import { Subject, SubjectSection } from '@/lib/types';

export async function getSubjects(sectionId: string): Promise<Subject[]> {
  // Get subject IDs linked to this section via the subject_sections junction table
  const subjectSections = await db.subjectSections
    .where('sectionId')
    .equals(sectionId)
    .toArray();
  
  if (subjectSections.length === 0) {
    return [];
  }
  
  // Fetch all subjects by their IDs
  const subjectIds = subjectSections.map(ss => ss.subjectId);
  const subjects = await db.subjects
    .where('id')
    .anyOf(subjectIds)
    .toArray();
  
  return subjects;
}

export async function getSubjectById(id: string): Promise<Subject | undefined> {
  return db.subjects.get(id);
}

export async function getSubjectSections(subjectId: string): Promise<string[]> {
  const subjectSections = await db.subjectSections
    .where('subjectId')
    .equals(subjectId)
    .toArray();
  return subjectSections.map(ss => ss.sectionId);
}

export async function getSubjectsForAdmin(universityId: string): Promise<Subject[]> {
  return db.subjects
    .where('universityId')
    .equals(universityId)
    .toArray();
}

export async function createSubject(
  subject: Subject, 
  sectionIds: string[], 
  userId: string
): Promise<void> {
  await db.transaction('rw', [db.subjects, db.subjectSections, db.syncQueue], async () => {
    // Create the subject (without section_id set)
    await db.subjects.put(subject);
    
    // Queue subject creation
    await db.syncQueue.add({
      universityId: subject.universityId,
      ownerId: userId,
      type: 'create',
      collection: 'subjects',
      docId: subject.id,
      data: {
        id: subject.id,
        university_id: subject.universityId,
        department_id: subject.departmentId,
        name: subject.name,
        code: subject.code,
        created_at: subject.createdAt,
        created_by: subject.createdBy,
      },
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
    
    // Create subject_sections relationships locally and queue them
    for (const sectionId of sectionIds) {
      // Check if the combination already exists
      const existingLink = await db.subjectSections
        .where(['subjectId', 'sectionId'])
        .equals([subject.id, sectionId])
        .first();
      
      if (!existingLink) {
        const subjectSectionId = crypto.randomUUID();
        const subjectSection: SubjectSection = {
          id: subjectSectionId,
          subjectId: subject.id,
          sectionId: sectionId,
          createdAt: new Date().toISOString(),
          createdBy: userId,
        };
        
        // Add to local DB
        await db.subjectSections.put(subjectSection);
        
        // Queue sync
        await db.syncQueue.add({
          universityId: subject.universityId,
          ownerId: userId,
          type: 'create',
          collection: 'subject_sections',
          docId: subjectSectionId,
          data: {
            id: subjectSectionId,
            subject_id: subject.id,
            section_id: sectionId,
            created_at: subjectSection.createdAt,
            created_by: userId,
          },
          createdAt: new Date().toISOString(),
          retryCount: 0,
        });
      }
    }
  });
}

export async function deleteSubject(subjectId: string, universityId: string, userId: string): Promise<void> {
  await db.transaction('rw', [db.subjects, db.subjectSections, db.attendanceSessions, db.userSubjects, db.syncQueue], async () => {
    // Delete local data
    await db.attendanceSessions.where('subjectId').equals(subjectId).delete();
    await db.userSubjects.where('subjectId').equals(subjectId).delete();
    await db.subjectSections.where('subjectId').equals(subjectId).delete();
    await db.subjects.delete(subjectId);

    // Queue subject deletion (cascade will handle subject_sections on server)
    await db.syncQueue.add({
      universityId,
      ownerId: userId,
      type: 'delete',
      collection: 'subjects',
      docId: subjectId,
      data: null,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
  });
}

export async function updateSubject(
  subject: Subject,
  sectionIds: string[],
  userId: string
): Promise<void> {
  await db.transaction('rw', [db.subjects, db.subjectSections, db.syncQueue], async () => {
    // Get existing section assignments
    const existingSections = await db.subjectSections
      .where('subjectId')
      .equals(subject.id)
      .toArray();
    const existingSectionIds = existingSections.map(ss => ss.sectionId);
    
    // Determine sections to add and remove
    const sectionsToAdd = sectionIds.filter(id => !existingSectionIds.includes(id));
    const sectionsToRemove = existingSections.filter(ss => !sectionIds.includes(ss.sectionId));
    
    // Update the subject itself
    await db.subjects.put(subject);
    
    // Queue subject update
    await db.syncQueue.add({
      universityId: subject.universityId,
      ownerId: userId,
      type: 'update',
      collection: 'subjects',
      docId: subject.id,
      data: {
        id: subject.id,
        university_id: subject.universityId,
        department_id: subject.departmentId,
        name: subject.name,
        code: subject.code,
      },
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
    
    // Remove old section assignments
    for (const ss of sectionsToRemove) {
      await db.subjectSections.delete(ss.id);
      await db.syncQueue.add({
        universityId: subject.universityId,
        ownerId: userId,
        type: 'delete',
        collection: 'subject_sections',
        docId: ss.id,
        data: null,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
    }
    
    // Add new section assignments
    for (const sectionId of sectionsToAdd) {
      // Check if the combination already exists
      const existingLink = await db.subjectSections
        .where(['subjectId', 'sectionId'])
        .equals([subject.id, sectionId])
        .first();
      
      if (!existingLink) {
        const subjectSectionId = crypto.randomUUID();
        const newSubjectSection: SubjectSection = {
          id: subjectSectionId,
          subjectId: subject.id,
          sectionId: sectionId,
          createdAt: new Date().toISOString(),
          createdBy: userId,
        };
        
        await db.subjectSections.put(newSubjectSection);
        await db.syncQueue.add({
          universityId: subject.universityId,
          ownerId: userId,
          type: 'create',
          collection: 'subject_sections',
          docId: subjectSectionId,
          data: {
            id: subjectSectionId,
            subject_id: subject.id,
            section_id: sectionId,
            created_at: newSubjectSection.createdAt,
            created_by: userId,
          },
          createdAt: new Date().toISOString(),
          retryCount: 0,
        });
      }
    }
  });
}
