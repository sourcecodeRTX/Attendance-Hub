import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from './navigation';

describe('Navigation constants and labels', () => {
  it('uses consistent plural and descriptive labels for admin navigation items', () => {
    const adminItems = NAV_ITEMS.admin;
    const labelMap = Object.fromEntries(adminItems.map((item) => [item.href, item.label]));

    expect(labelMap['/branches']).toBe('Branches');
    expect(labelMap['/specialisations']).toBe('Specialisations');
    expect(labelMap['/sections']).toBe('Sections');
    expect(labelMap['/subjects']).toBe('Subjects');
    expect(labelMap['/teachers']).toBe('Teachers');
    expect(labelMap['/students']).toBe('Students');
    expect(labelMap['/activity-logs']).toBe('Activity Logs');
    expect(labelMap['/export']).toBe('Export');
    expect(labelMap['/settings']).toBe('Settings');
  });

  it('provides navigation items for all supported roles', () => {
    expect(NAV_ITEMS.super_admin.length).toBeGreaterThan(0);
    expect(NAV_ITEMS.admin.length).toBeGreaterThan(0);
    expect(NAV_ITEMS.primary_teacher.length).toBeGreaterThan(0);
    expect(NAV_ITEMS.regular_teacher.length).toBeGreaterThan(0);
    expect(NAV_ITEMS.cr.length).toBeGreaterThan(0);
  });
});
