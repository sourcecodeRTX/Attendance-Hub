'use client';

import { useEffect, useState } from 'react';
import { getLocalDateString } from '@/lib/utils/date';

export function useLocalDateString(): string {
  const [today, setToday] = useState(() => getLocalDateString());

  useEffect(() => {
    const id = setInterval(() => {
      setToday((prev) => {
        const next = getLocalDateString();
        return prev === next ? prev : next;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return today;
}
