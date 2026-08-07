import { db } from './index';
import { Student } from '@/lib/types';

export async function getStudents(sectionId: string): Promise<Student[]> {
  return db.students.where('sectionId').equals(sectionId).toArray();
}

export async function getStudentsByUniversity(universityId: string): Promise<Student[]> {
  return db.students.where('universityId').equals(universityId).toArray();
}

export async function getActiveStudents(sectionId: string): Promise<Student[]> {
  return db.students
    .where({ sectionId })
    .filter(s => s.isActive)
    .toArray();
}

export async function createStudent(student: Student, userId: string): Promise<void> {
  await db.students.put(student);
  await db.syncQueue.add({
    universityId: student.universityId,
    ownerId: userId,
    type: 'create',
    collection: 'students',
    docId: student.id,
    data: {
      id: student.id,
      university_id: student.universityId,
      department_id: student.departmentId,
      branch_id: student.branchId,
      specialisation_id: student.specialisationId,
      section_id: student.sectionId,
      roll_number: student.rollNumber,
      full_name: student.fullName,
      is_active: student.isActive,
      uploaded_at: student.uploadedAt,
      uploaded_by: student.uploadedBy,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function createStudentsBulk(students: Student[], userId: string): Promise<void> {
  if (students.length === 0) return;

  await db.transaction('rw', [db.students, db.syncQueue], async () => {
    await db.students.bulkPut(students);

    const now = new Date().toISOString();
    const first = students[0];
    await db.syncQueue.add({
      universityId: first.universityId,
      ownerId: userId,
      type: 'bulk_create',
      collection: 'students',
      docId: `bulk_${first.sectionId}_${now}`,
      data: students.map((student) => ({
        id: student.id,
        university_id: student.universityId,
        department_id: student.departmentId,
        branch_id: student.branchId,
        specialisation_id: student.specialisationId,
        section_id: student.sectionId,
        roll_number: student.rollNumber,
        full_name: student.fullName,
        is_active: student.isActive,
        uploaded_at: student.uploadedAt,
        uploaded_by: student.uploadedBy,
      })),
      createdAt: now,
      retryCount: 0,
    });
  });
}

export async function updateStudent(student: Student, userId: string): Promise<void> {
  await db.students.put(student);
  await db.syncQueue.add({
    universityId: student.universityId,
    ownerId: userId,
    type: 'update',
    collection: 'students',
    docId: student.id,
    data: {
      section_id: student.sectionId,
      branch_id: student.branchId,
      specialisation_id: student.specialisationId,
      roll_number: student.rollNumber,
      full_name: student.fullName,
      is_active: student.isActive,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function softDeleteStudent(studentId: string, universityId: string, userId: string): Promise<void> {
  const student = await db.students.get(studentId);
  if (!student) return;

  student.isActive = false;
  await db.students.put(student);
  await db.syncQueue.add({
    universityId,
    ownerId: userId,
    type: 'update',
    collection: 'students',
    docId: studentId,
    data: { is_active: false },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}
