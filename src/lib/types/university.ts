export interface University {
  id: string;
  name: string;
  code: string;
  superAdminId: string;
  attendanceThreshold: number;
  createdAt: string;
}

export interface Department {
  id: string;
  universityId: string;
  name: string;
  code: string;
  adminId: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export interface Branch {
  id: string;
  universityId: string;
  departmentId: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export interface Specialisation {
  id: string;
  universityId: string;
  departmentId: string;
  branchId: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export interface Section {
  id: string;
  universityId: string;
  departmentId: string;
  branchId: string;
  specialisationId: string;
  name: string;
  primaryTeacherId: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  createdBy: string;
}

export interface UserSection {
  id: string;
  universityId: string;
  userId: string;
  sectionId: string;
  userRole: 'primary_teacher' | 'cr';
  assignedAt: string;
  assignedBy: string;
}

export interface UserSubject {
  id: string;
  universityId: string;
  userId: string;
  subjectId: string;
  sectionId: string;
  assignedAt: string;
  assignedBy: string;
}

export interface LogSettings {
  id: string;
  universityId: string;
  autoDeleteEnabled: boolean;
  retentionDays: number | null;
  lastAutoCleanupAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
}
