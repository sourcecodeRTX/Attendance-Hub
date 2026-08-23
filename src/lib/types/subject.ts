export interface Subject {
  id: string;
  universityId: string;
  departmentId: string;
  sectionId?: string; // Deprecated legacy column (dropped in migration 013) - section links live in subject_sections
  name: string;
  code: string;
  createdAt: string;
  createdBy: string;
}

export interface SubjectSection {
  id: string;
  subjectId: string;
  sectionId: string;
  createdAt: string;
  createdBy: string;
}
