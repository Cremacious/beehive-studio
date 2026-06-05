import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  type Call = { type: 'update'; table: unknown; set: Record<string, unknown>; whereCalled: boolean };
  return {
    findFirstMock: vi.fn(),
    updateCalls: [] as Call[],
    insertValues: vi.fn(),
  };
});

vi.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'fake-cuid',
}));

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
  },
}));

// We don't need to mock @/lib/social/record-activity — we want it to actually run
// against our fake tx so we can assert the insert side-effect on social_activity.

import { deriveCurrentBookTx } from '../derive-current-book';
import { bookClubs, bookClubBooks } from '@/db/schema/social';
import { socialActivity } from '@/db/schema/social';

function nameForTable(table: unknown): string {
  if (table === bookClubBooks) return 'book_club_books';
  if (table === bookClubs) return 'book_clubs';
  if (table === socialActivity) return 'social_activity';
  return 'unknown';
}

function makeTx(findFirstImpl: () => unknown) {
  const updates: Array<{ table: string; set: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];

  const updateMock = vi.fn((table: unknown) => {
    const name = nameForTable(table);
    return {
      set: vi.fn((set: Record<string, unknown>) => {
        updates.push({ table: name, set });
        return { where: vi.fn(async () => undefined) };
      }),
    };
  });

  const insertMock = vi.fn((table: unknown) => {
    const name = nameForTable(table);
    return {
      values: vi.fn(async (values: Record<string, unknown>) => {
        inserts.push({ table: name, values });
        return undefined;
      }),
    };
  });

  const tx = {
    query: {
      bookClubBooks: {
        findFirst: vi.fn(async () => findFirstImpl()),
      },
      socialActivity: {
        findFirst: vi.fn(async () => undefined),
      },
    },
    update: updateMock,
    insert: insertMock,
  } as unknown as Parameters<typeof deriveCurrentBookTx>[0];

  return { tx, updates, inserts };
}

beforeEach(() => {
  mocks.findFirstMock.mockReset();
  mocks.updateCalls.length = 0;
  mocks.insertValues.mockReset();
});

describe('deriveCurrentBookTx', () => {
  it('no existing CURRENT: flips target to CURRENT, updates pointer, fires activity (PUBLIC+discoverable)', async () => {
    let callCount = 0;
    const { tx, updates, inserts } = makeTx(() => {
      callCount++;
      if (callCount === 1) return undefined; // no existing CURRENT
      return { title: 'New Book' }; // newRow lookup for activity payload
    });

    await deriveCurrentBookTx(tx, {
      clubId: 'club-1',
      newCurrentBookId: 'bcb-new',
      actorId: 'actor-1',
      clubName: 'My Club',
      clubVisibility: 'PUBLIC',
      clubDiscoverable: true,
    });

    // No PAST flip when no existing CURRENT
    expect(updates.filter((u) => u.set.status === 'PAST')).toHaveLength(0);
    // Target flipped to CURRENT
    expect(updates.some((u) => u.table === 'book_club_books' && u.set.status === 'CURRENT')).toBe(
      true,
    );
    // Pointer updated on bookClubs
    expect(
      updates.some(
        (u) => u.table === 'book_clubs' && u.set.currentBookId === 'bcb-new',
      ),
    ).toBe(true);
    // Activity event fired
    expect(inserts.some((i) => i.table === 'social_activity')).toBe(true);
    const act = inserts.find((i) => i.table === 'social_activity')!;
    expect(act.values.type).toBe('book_club_current_book_changed');
    expect(act.values.subjectType).toBe('book_club');
    expect(act.values.subjectId).toBe('club-1');
    expect(act.values.payload).toMatchObject({
      clubName: 'My Club',
      fromBookTitle: null,
      toBookTitle: 'New Book',
    });
  });

  it('existing CURRENT: flips to PAST then new CURRENT', async () => {
    let callCount = 0;
    const { tx, updates, inserts } = makeTx(() => {
      callCount++;
      if (callCount === 1) return { id: 'bcb-old', title: 'Old Book' };
      return { title: 'New Book' };
    });

    await deriveCurrentBookTx(tx, {
      clubId: 'club-1',
      newCurrentBookId: 'bcb-new',
      actorId: 'actor-1',
      clubName: 'My Club',
      clubVisibility: 'PUBLIC',
      clubDiscoverable: true,
    });

    // PAST flip happened
    expect(updates.some((u) => u.table === 'book_club_books' && u.set.status === 'PAST')).toBe(
      true,
    );
    // New CURRENT also set
    expect(updates.some((u) => u.table === 'book_club_books' && u.set.status === 'CURRENT')).toBe(
      true,
    );
    // Activity event carries fromBookTitle
    const act = inserts.find((i) => i.table === 'social_activity')!;
    expect(act.values.payload).toMatchObject({
      fromBookTitle: 'Old Book',
      toBookTitle: 'New Book',
    });
  });

  it('skips activity event when visibility=FRIENDS or discoverable=false', async () => {
    let callCount = 0;
    const { tx, inserts } = makeTx(() => {
      callCount++;
      if (callCount === 1) return undefined;
      return { title: 'New Book' };
    });

    await deriveCurrentBookTx(tx, {
      clubId: 'club-1',
      newCurrentBookId: 'bcb-new',
      actorId: 'actor-1',
      clubName: 'My Club',
      clubVisibility: 'FRIENDS',
      clubDiscoverable: true,
    });

    expect(inserts.some((i) => i.table === 'social_activity')).toBe(false);

    // Also test discoverable=false on PUBLIC
    const { tx: tx2, inserts: inserts2 } = makeTx(() => undefined);
    await deriveCurrentBookTx(tx2, {
      clubId: 'club-2',
      newCurrentBookId: 'bcb-new-2',
      actorId: 'actor-1',
      clubName: 'My Club',
      clubVisibility: 'PUBLIC',
      clubDiscoverable: false,
    });
    expect(inserts2.some((i) => i.table === 'social_activity')).toBe(false);
  });
});
