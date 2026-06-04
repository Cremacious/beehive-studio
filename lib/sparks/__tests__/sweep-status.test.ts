import { describe, it, expect, vi } from 'vitest';

const updateSpy = vi.fn();

vi.mock('@/db', () => ({
  db: {
    update: (...args: unknown[]) => {
      updateSpy(...args);
      return {
        set: () => ({
          where: async () => undefined,
        }),
      };
    },
  },
}));

import { sweepSparkStatuses } from '../sweep-status';
import { sparks } from '@/db/schema/social';

describe('sweepSparkStatuses surface', () => {
  it('issues two UPDATE statements against the sparks table', async () => {
    updateSpy.mockClear();
    await sweepSparkStatuses();
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenNthCalledWith(1, sparks);
    expect(updateSpy).toHaveBeenNthCalledWith(2, sparks);
  });
});
