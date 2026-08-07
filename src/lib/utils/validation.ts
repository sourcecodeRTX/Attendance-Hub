import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  staffId: z.string().min(1, 'Staff ID is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  universityName: z.string().min(2, 'University name is required'),
  universityCode: z.string().min(2, 'University code is required').max(20, 'Code too long'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(1, 'Code is required').max(20, 'Code too long'),
});

export const adminAccountSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  staffId: z.string().min(1, 'Staff ID is required'),
  email: z.string().email('Invalid email address'),
});

export const branchSchema = z.object({
  name: z.string().min(2, 'Branch name is required'),
  code: z.string().min(1, 'Code is required').max(20, 'Code too long'),
});

export const specialisationSchema = z.object({
  name: z.string().min(2, 'Specialisation name is required'),
  code: z.string().min(1, 'Code is required').max(20, 'Code too long'),
  branchId: z.string().uuid('Branch is required'),
});

export const sectionSchema = z.object({
  name: z.string().min(1, 'Section name is required'),
  specialisationId: z.string().uuid('Specialisation is required'),
});

export const teacherAccountSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  staffId: z.string().min(1, 'Staff ID is required'),
  email: z.string().email('Invalid email address'),
});

export const subjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required'),
  code: z.string().min(1, 'Code is required').max(20, 'Code too long'),
});

export const universitySettingsSchema = z.object({
  name: z.string().min(2, 'University name is required'),
  code: z.string().min(2, 'Code is required').max(20, 'Code too long'),
  attendanceThreshold: z.number().min(1).max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type AdminAccountInput = z.infer<typeof adminAccountSchema>;
export type BranchInput = z.infer<typeof branchSchema>;
export type SpecialisationInput = z.infer<typeof specialisationSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
export type TeacherAccountInput = z.infer<typeof teacherAccountSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type UniversitySettingsInput = z.infer<typeof universitySettingsSchema>;
