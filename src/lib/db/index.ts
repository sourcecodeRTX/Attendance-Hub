import Dexie, { Table } from 'dexie';
import type {
  User, Student, Subject, AttendanceSession,
  Section, UserSection, UserSubject,
  Department, Branch, Specialisation, CachedAnalytics, SubjectSection
} from '@/lib/types';
import type { SyncQueueItem } from '@/lib/types/sync';

class AttTrackerDB extends Dexie {
  users!: Table<User>;
  students!: Table<Student>;
  subjects!: Table<Subject>;
  subjectSections!: Table<SubjectSection>;
  attendanceSessions!: Table<AttendanceSession>;
  syncQueue!: Table<SyncQueueItem>;
  sections!: Table<Section>;
  userSections!: Table<UserSection>;
  userSubjects!: Table<UserSubject>;
  departments!: Table<Department>;
  branches!: Table<Branch>;
  specialisations!: Table<Specialisation>;
  cachedAnalytics!: Table<CachedAnalytics>;

  constructor() {
    super('AttTrackerDB');
    // v12: subjects.section_id was dropped server-side in migration 013;
    // section links live in subject_sections, so the subjects-table indexes
    // on sectionId (and [universityId+sectionId]) are removed.
    this.version(12).stores({
      users:              'id, universityId, role, departmentId',
      students:           'id, universityId, departmentId, sectionId, rollNumber, isActive, uploadedBy',
      subjects:           'id, universityId',
      subjectSections:    'id, subjectId, sectionId, [subjectId+sectionId]',
      attendanceSessions: 'id, universityId, subjectId, sectionId, date, [subjectId+date], lockedByTeacher, isArchived',
      syncQueue:          '++id, universityId, ownerId, type, collection, createdAt',
      sections:           'id, universityId, departmentId, [universityId+departmentId], branchId, isArchived, primaryTeacherId',
      userSections:       'id, universityId, userId, sectionId, [userId+sectionId]',
      userSubjects:       'id, universityId, userId, subjectId, sectionId, [subjectId+sectionId]',
      departments:        'id, universityId',
      branches:           'id, universityId, departmentId, [universityId+departmentId]',
      specialisations:    'id, universityId, branchId',
      cachedAnalytics:    'id, universityId',
    });
    this.version(11).stores({
      users:              'id, universityId, role, departmentId',
      students:           'id, universityId, departmentId, sectionId, rollNumber, isActive, uploadedBy',
      subjects:           'id, universityId, sectionId, [universityId+sectionId]',
      subjectSections:    'id, subjectId, sectionId, [subjectId+sectionId]',
      attendanceSessions: 'id, universityId, subjectId, sectionId, date, [subjectId+date], lockedByTeacher, isArchived',
      syncQueue:          '++id, universityId, ownerId, type, collection, createdAt',
      sections:           'id, universityId, departmentId, [universityId+departmentId], branchId, isArchived, primaryTeacherId',
      userSections:       'id, universityId, userId, sectionId, [userId+sectionId]',
      userSubjects:       'id, universityId, userId, subjectId, sectionId, [subjectId+sectionId]',
      departments:        'id, universityId',
      branches:           'id, universityId, departmentId, [universityId+departmentId]',
      specialisations:    'id, universityId, branchId',
      cachedAnalytics:    'id, universityId',
    });
    this.version(10).stores({
      users:              'id, universityId, role, departmentId',
      students:           'id, universityId, departmentId, sectionId, rollNumber, isActive, uploadedBy',
      subjects:           'id, universityId, sectionId',
      subjectSections:    'id, subjectId, sectionId',
      attendanceSessions: 'id, universityId, subjectId, sectionId, date, [subjectId+date], lockedByTeacher, isArchived',
      syncQueue:          '++id, universityId, ownerId, type, collection, createdAt',
      sections:           'id, universityId, departmentId, [universityId+departmentId], branchId, isArchived',
      userSections:       'id, universityId, userId, sectionId',
      userSubjects:       'id, universityId, userId, subjectId, sectionId',
      departments:        'id, universityId',
      branches:           'id, universityId, departmentId, [universityId+departmentId]',
      specialisations:    'id, universityId, branchId',
      cachedAnalytics:    'id, universityId',
    });
    this.version(8).stores({
      users:              'id, universityId, role, departmentId',
      students:           'id, universityId, departmentId, sectionId, rollNumber, isActive, uploadedBy',
      subjects:           'id, universityId, sectionId',
      attendanceSessions: 'id, universityId, subjectId, sectionId, date, [subjectId+date], lockedByTeacher, isArchived',
      syncQueue:          '++id, universityId, ownerId, type, collection, createdAt',
      sections:           'id, universityId, departmentId, [universityId+departmentId], branchId, isArchived',
      userSections:       'id, universityId, userId, sectionId',
      userSubjects:       'id, universityId, userId, subjectId, sectionId',
      departments:        'id, universityId',
      branches:           'id, universityId, departmentId, [universityId+departmentId]',
      specialisations:    'id, universityId, branchId',
      cachedAnalytics:    'id, universityId',
    });
  }
}

export const db = new AttTrackerDB();
