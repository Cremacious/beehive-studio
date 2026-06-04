import { createId } from '@paralleldrive/cuid2';
import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import { socialActivity } from '@/db/schema/social';
import { DEDUPE_ELIGIBLE, DEDUPE_WINDOW_MS, type RecordActivityOpts } from './types';

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function recordSocialActivityTx(
  tx: DrizzleTx,
  opts: RecordActivityOpts,
): Promise<void> {
  if (DEDUPE_ELIGIBLE.has(opts.type)) {
    const windowStart = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const existing = await tx.query.socialActivity.findFirst({
      where: and(
        eq(socialActivity.actorId, opts.actorId),
        eq(socialActivity.type, opts.type),
        eq(socialActivity.subjectId, opts.subjectId),
        gte(socialActivity.createdAt, windowStart),
      ),
      columns: { id: true },
    });
    if (existing) return;
  }

  await tx.insert(socialActivity).values({
    id: createId(),
    actorId: opts.actorId,
    type: opts.type,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    payload: opts.payload ?? null,
  });
}
