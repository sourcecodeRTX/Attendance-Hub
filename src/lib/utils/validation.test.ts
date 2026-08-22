import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  sectionSchema,
  universitySettingsSchema,
} from '@/lib/utils/validation';

describe('registerSchema', () => {
  const valid = {
    fullName: 'Ada Lovelace',
    staffId: 'S-001',
    email: 'ada@example.edu',
    password: 'correcthorse',
    universityName: 'Example University',
    universityCode: 'EXU',
  };

  it('accepts a fully valid payload', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects names shorter than 2 characters', () => {
    expect(registerSchema.safeParse({ ...valid, fullName: 'A' }).success).toBe(false);
  });

  it('rejects invalid emails', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });

  it('rejects university codes longer than 20 characters', () => {
    expect(registerSchema.safeParse({ ...valid, universityCode: 'X'.repeat(21) }).success).toBe(
      false
    );
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials shape', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts matching passwords of sufficient length', () => {
    expect(
      changePasswordSchema.safeParse({ newPassword: 'longenough1', confirmPassword: 'longenough1' })
        .success
    ).toBe(true);
  });

  it('rejects mismatched confirmation', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'longenough1',
      confirmPassword: 'different123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword']);
    }
  });

  it('rejects too-short passwords even when matching', () => {
    expect(
      changePasswordSchema.safeParse({ newPassword: 'short', confirmPassword: 'short' }).success
    ).toBe(false);
  });
});

describe('sectionSchema', () => {
  it('accepts an absent specialisationId', () => {
    expect(sectionSchema.safeParse({ name: 'A1', branchId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }).success).toBe(true);
  });

  it('accepts an empty-string specialisationId', () => {
    expect(
      sectionSchema.safeParse({
        name: 'A1',
        branchId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        specialisationId: '',
      }).success
    ).toBe(true);
  });

  it('rejects a non-UUID specialisationId', () => {
    expect(
      sectionSchema.safeParse({
        name: 'A1',
        branchId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        specialisationId: 'not-a-uuid',
      }).success
    ).toBe(false);
  });
});

describe('universitySettingsSchema', () => {
  const base = { name: 'Example University', code: 'EXU' };

  it('accepts thresholds at the inclusive bounds 1 and 100', () => {
    expect(universitySettingsSchema.safeParse({ ...base, attendanceThreshold: 1 }).success).toBe(true);
    expect(universitySettingsSchema.safeParse({ ...base, attendanceThreshold: 100 }).success).toBe(true);
  });

  it('rejects thresholds below 1 and above 100', () => {
    expect(universitySettingsSchema.safeParse({ ...base, attendanceThreshold: 0 }).success).toBe(false);
    expect(universitySettingsSchema.safeParse({ ...base, attendanceThreshold: 101 }).success).toBe(false);
  });

  it('rejects non-numeric thresholds', () => {
    expect(universitySettingsSchema.safeParse({ ...base, attendanceThreshold: '75' }).success).toBe(false);
  });
});
