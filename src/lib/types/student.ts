export interface Student {
  id: string;
  universityId: string;
  departmentId: string;
  branchId: string;
  specialisationId: string | null;
  sectionId: string;
  rollNumber: string;
  fullName: string;
  isActive: boolean;
  uploadedAt: string;
  uploadedBy: string;
}

export interface CreateStudentInput {
  rollNumber: string;
  fullName: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; reason: string }[];
}
