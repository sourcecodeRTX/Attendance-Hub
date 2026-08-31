import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from './index';
import { getSectionAnalytics } from './analytics';
import { invalidateAnalyticsCache } from './attendance';

describe('analytics cache invalidation (F-014)', () => {
  beforeEach(async () => {
    await db.cachedAnalytics.clear();
    await db.subjects.clear();
    await db.subjectSections.clear();
    await db.attendanceSessions.clear();
  });

  it('getSectionAnalytics stores sectionId and caches computed summaries', async () => {
    await db.subjects.put({
      id: 'sub-1',
      universityId: 'uni-1',
      departmentId: 'dept-1',
      name: 'Mathematics',
      code: 'MATH101',
      createdAt: '2026-08-01T00:00:00Z',
      createdBy: 'usr-1',
    });

    await db.subjectSections.put({
      id: 'ss-1',
      subjectId: 'sub-1',
      sectionId: 'sec-1',
      createdAt: '2026-08-01T00:00:00Z',
      createdBy: 'usr-1',
    });

    const summaries = await getSectionAnalytics('sec-1', 'uni-1', 75);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].subjectId).toBe('sub-1');

    const cached = await db.cachedAnalytics.get('section_sec-1');
    expect(cached).toBeDefined();
    expect(cached?.universityId).toBe('uni-1');
    expect(cached?.sectionId).toBe('sec-1');
  });

  it('invalidateAnalyticsCache selectively deletes only the targeted section cache without prefix collisions', async () => {
    // Populate two cache entries where one is a prefix of the other: sec-1 vs sec-10
    await db.cachedAnalytics.put({
      id: 'section_sec-1',
      universityId: 'uni-1',
      sectionId: 'sec-1',
      data: [],
      computedAt: new Date().toISOString(),
    });

    await db.cachedAnalytics.put({
      id: 'section_sec-10',
      universityId: 'uni-1',
      sectionId: 'sec-10',
      data: [],
      computedAt: new Date().toISOString(),
    });

    // Invalidate sec-1
    await invalidateAnalyticsCache('sec-1');

    // sec-1 must be deleted, while sec-10 MUST survive intact!
    const cacheSec1 = await db.cachedAnalytics.get('section_sec-1');
    const cacheSec10 = await db.cachedAnalytics.get('section_sec-10');

    expect(cacheSec1).toBeUndefined();
    expect(cacheSec10).toBeDefined();
    expect(cacheSec10?.sectionId).toBe('sec-10');
  });
});
