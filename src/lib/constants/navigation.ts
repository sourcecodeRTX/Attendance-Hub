import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Layers,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  UserCog,
  FileBarChart,
  Settings,
  Activity,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Departments', href: '/departments', icon: Building2 },
    { label: 'Activity Logs', href: '/activity-logs', icon: Activity },
    { label: 'Export', href: '/export', icon: FileBarChart },
    { label: 'Settings', href: '/settings', icon: Settings },
  ],
  admin: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Branches', href: '/branches', icon: GitBranch },
    { label: 'Specialisation', href: '/specialisations', icon: Layers },
    { label: 'Section', href: '/sections', icon: Users },
    { label: 'Subjects', href: '/subjects', icon: BookOpen },
    { label: 'Teacher', href: '/teachers', icon: GraduationCap },
    { label: 'Logs', href: '/activity-logs', icon: Activity },
    { label: 'Export', href: '/export', icon: FileBarChart },
    { label: 'Students', href: '/students', icon: GraduationCap },
    { label: 'Settings', href: '/settings', icon: Settings },
  ],
  primary_teacher: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Students', href: '/students', icon: BookOpen },
    { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
    { label: 'CR Management', href: '/cr-management', icon: UserCog },
    { label: 'Export', href: '/export', icon: FileBarChart },
    { label: 'Settings', href: '/settings', icon: Settings },
  ],
  regular_teacher: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
    { label: 'Students', href: '/students', icon: BookOpen },
    { label: 'Settings', href: '/settings', icon: Settings },
  ],
  cr: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
    { label: 'Students', href: '/students', icon: BookOpen },
    { label: 'Settings', href: '/settings', icon: Settings },
  ],
};
