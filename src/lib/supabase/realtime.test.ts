import { beforeEach, describe, expect, it, vi } from 'vitest';

type ChangeHandler = (payload: unknown) => void;

const channelCalls: {
  name: string;
  eventConfig?: unknown;
  callback?: ChangeHandler;
}[] = [];
const subscribedChannels: string[] = [];

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    channel(name: string) {
      const record: (typeof channelCalls)[number] = { name };
      channelCalls.push(record);
      return {
        on(_type: string, config: unknown, callback: ChangeHandler) {
          record.eventConfig = config;
          record.callback = callback;
          return this;
        },
        subscribe() {
          subscribedChannels.push(name);
          return this;
        },
      };
    },
  })),
}));

import { subscribeToStudents } from '@/lib/supabase/realtime';
import { createClient } from '@/lib/supabase/client';

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  channelCalls.length = 0;
  subscribedChannels.length = 0;
  mockedCreateClient.mockClear();
});

describe('subscribeToStudents (mocked supabase-js client pattern)', () => {
  it('creates exactly one channel named after table+filter and subscribes to it', () => {
    subscribeToStudents('sec-42', () => {});

    expect(mockedCreateClient).toHaveBeenCalledTimes(1);
    expect(channelCalls).toHaveLength(1);
    expect(channelCalls[0].name).toBe('students:section_id=sec-42');
    expect(subscribedChannels).toEqual(['students:section_id=sec-42']);
  });

  it('registers a postgres_changes listener scoped to the section filter and forwards payloads to the callback', () => {
    const received: unknown[] = [];
    subscribeToStudents('sec-7', (payload) => received.push(payload));

    const config = channelCalls[0].eventConfig as Record<string, unknown>;
    expect(config).toMatchObject({
      event: '*',
      schema: 'public',
      table: 'students',
      filter: 'section_id=eq.sec-7',
    });

    const fakePayload = { eventType: 'INSERT', new: { id: 'st-1' }, old: {} };
    channelCalls[0].callback!(fakePayload);
    expect(received).toEqual([fakePayload]);
  });
});
