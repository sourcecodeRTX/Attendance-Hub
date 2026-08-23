import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  shouldFail: false,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: async () =>
          h.shouldFail
            ? { data: null, error: { message: 'Network unreachable' } }
            : { data: [], error: null },
      }),
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
  },
}));

import { db } from '@/lib/db/index';
import { getDepartments } from '@/lib/db/university';
import { toast } from 'sonner';
import type { Department } from '@/lib/types';

function makeDept(overrides: Partial<Department> = {}): Department {
  return {
    id: 'dept-1',
    universityId: 'uni-1',
    name: 'Computer Science',
    code: 'CS',
    adminId: 'admin-1',
    isActive: true,
    createdAt: '2026-08-22T09:00:00.000Z',
    createdBy: 'user-1',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  h.shouldFail = false;
  vi.mocked(toast.warning).mockClear();
});

describe('getDepartments stale-cache honesty (F-024)', () => {
  it('returns fresh cloud rows and stays silent on success', async () => {
    const cached = await getDepartments('uni-1');
    expect(cached).toEqual([]);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('falls back to the local cache on fetch failure AND warns about staleness', async () => {
    const dept = makeDept();
    await db.departments.put(dept);

    h.shouldFail = true;
    const result = await getDepartments('uni-1');

    expect(result).toEqual([dept]);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(toast.warning).mock.calls[0][0])).toMatch(/saved/i);
  });
});
