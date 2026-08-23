import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  sectionSchema,
  subjectSchema,
  universitySettingsSchema,
  managedAuthUserSchema,
  managedProfileSchema,
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

  it('rejects whitespace-only names (F-029)', () => {
    expect(registerSchema.safeParse({ ...valid, fullName: '   ' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, universityName: '  ' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, staffId: ' ' }).success).toBe(false);
  });

  it('trims surrounding whitespace from parsed values (F-029)', () => {
    const result = registerSchema.parse({
      ...valid,
      fullName: '  Ada Lovelace  ',
      universityCode: ' EXU ',
    });
    expect(result.fullName).toBe('Ada Lovelace');
    expect(result.universityCode).toBe('EXU');
  });

  it('enforces maximum lengths on person and university names (F-029)', () => {
    expect(registerSchema.safeParse({ ...valid, fullName: 'A'.repeat(101) }).success).toBe(false);
    expect(
      registerSchema.safeParse({ ...valid, universityName: 'U'.repeat(151) }).success
    ).toBe(false);
  });

  it('rejects passwords longer than the 72-byte auth limit (F-029)', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'x'.repeat(73) }).success).toBe(false);
  });
});

describe('schema refinements (F-029)', () => {
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('rejects whitespace-only subject/section/department names', () => {
    expect(subjectSchema.safeParse({ name: '   ', code: 'CS' }).success).toBe(false);
    expect(sectionSchema.safeParse({ name: '  ', branchId: uuid }).success).toBe(false);
  });

  it('rejects over-long passwords at password-change time', () => {
    expect(
      changePasswordSchema.safeParse({
        newPassword: 'x'.repeat(73),
        confirmPassword: 'x'.repeat(73),
      }).success
    ).toBe(false);
  });
});

describe('managedAuthUserSchema (F-029 server-side guard)', () => {
  it('accepts a valid credential pair', () => {
    expect(managedAuthUserSchema.safeParse({ email: 'a@b.co', password: 'Temp-abcd1234' }).success).toBe(
      true
    );
  });

  it('rejects bad emails, short and over-long passwords', () => {
    expect(managedAuthUserSchema.safeParse({ email: 'nope', password: 'Temp-abcd1234' }).success).toBe(
      false
    );
    expect(managedAuthUserSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(
      false
    );
    expect(managedAuthUserSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(73) }).success).toBe(
      false
    );
  });
});

describe('managedProfileSchema (F-029 server-side guard)', () => {
  const validProfile = { full_name: 'Target Person', staff_id: 'ST-1', email: 't@uni.com' };

  it('accepts a valid profile triple and trims values', () => {
    const result = managedProfileSchema.parse({
      full_name: '  Target Person ',
      staff_id: ' ST-1',
      email: ' t@uni.com ',
    });
    expect(result).toEqual(validProfile);
  });

  it('rejects whitespace-only names and invalid emails', () => {
    expect(managedProfileSchema.safeParse({ ...validProfile, full_name: ' ' }).success).toBe(false);
    expect(managedProfileSchema.safeParse({ ...validProfile, staff_id: '' }).success).toBe(false);
    expect(managedProfileSchema.safeParse({ ...validProfile, email: 'bad' }).success).toBe(false);
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
