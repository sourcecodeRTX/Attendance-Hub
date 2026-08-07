export type UserRole = 'super_admin' | 'admin' | 'primary_teacher' | 'regular_teacher' | 'cr';

export interface User {
  id: string;
  universityId: string;
  role: UserRole;
  fullName: string;
  staffId: string;
  email: string;
  departmentId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  createdBy: string | null;
}

export interface UserPreferences {
  sortOrder: 'original' | 'roll_number' | 'name';
  sortDirection: 'asc' | 'desc';
  soundEnabled: boolean;
}
