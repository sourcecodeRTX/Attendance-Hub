export interface Subject {
  id: string;
  universityId: string;
  departmentId: string;
  sectionId: string; // Deprecated - will be removed
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
