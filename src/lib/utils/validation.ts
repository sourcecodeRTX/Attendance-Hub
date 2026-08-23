import { z } from 'zod';

// Shared field primitives — trim first so whitespace-only values fail .min()
// and stored values never carry leading/trailing whitespace.
const personName = (label = 'Full name') =>
  z.string().trim().min(2, `${label} must be at least 2 characters`).max(100, `${label} is too long`);
const codeField = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(20, 'Code too long');
const emailField = z.string().trim().email('Invalid email address');
const staffIdField = z
  .string()
  .trim()
  .min(1, 'Staff ID is required')
  .max(50, 'Staff ID is too long');
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const registerSchema = z.object({
  fullName: personName(),
  staffId: staffIdField,
  email: emailField,
  password: passwordField,
  universityName: z
    .string()
    .trim()
    .min(2, 'University name is required')
    .max(150, 'University name is too long'),
  universityCode: z
    .string()
    .trim()
    .min(2, 'University code is required')
    .max(20, 'Code too long'),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  newPassword: passwordField,
  confirmPassword: passwordField,
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const departmentSchema = z.object({
  name: personName('Department name'),
  code: codeField('Code'),
});

export const adminAccountSchema = z.object({
  fullName: personName(),
  staffId: staffIdField,
  email: emailField,
});

export const branchSchema = z.object({
  name: personName('Branch name'),
  code: codeField('Code'),
});

export const specialisationSchema = z.object({
  name: personName('Specialisation name'),
  code: codeField('Code'),
  branchId: z.string().uuid('Branch is required'),
});

export const sectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Section name is required')
    .max(50, 'Section name is too long'),
  branchId: z.string().uuid('Branch is required'),
  specialisationId: z.string().uuid('Invalid specialisation ID').optional().or(z.literal('')),
});

export const teacherAccountSchema = z.object({
  fullName: personName(),
  staffId: staffIdField,
  email: emailField,
});

export const subjectSchema = z.object({
  name: personName('Subject name'),
  code: codeField('Code'),
});

export const universitySettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'University name is required')
    .max(150, 'University name is too long'),
  code: z
    .string()
    .trim()
    .min(2, 'Code is required')
    .max(20, 'Code too long'),
  attendanceThreshold: z.number().min(1).max(100),
});

export const managedAuthUserSchema = z.object({
  email: emailField,
  password: passwordField,
});

export const managedProfileSchema = z.object({
  full_name: personName(),
  staff_id: staffIdField,
  email: emailField,
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
