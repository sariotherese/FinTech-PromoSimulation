import type { PromotionScenarioRecord, ScenarioSnapshot } from '@rayfin-app/shared';
import { parseSnapshot } from '@rayfin-app/shared';
import { getRayfinClient } from './rayfin-client';

export type SavedScenario = PromotionScenarioRecord & { data: ScenarioSnapshot };
const fields = ['id', 'title', 'storeId', 'snapshot', 'createdAt', 'updatedAt', 'owner_id'] as const;

export async function listScenarios(): Promise<SavedScenario[]> {
  const client = await getRayfinClient();
  const records: PromotionScenarioRecord[] = [];
  let cursor: string | undefined;
  do {
    const query = client.data.PromotionScenario.select([...fields])
      .orderBy({ updatedAt: 'desc', id: 'asc' }).first(100);
    const page = await (cursor ? query.after(cursor) : query).executePaginated();
    records.push(...page.items);
    if (page.hasNextPage && (!page.endCursor || page.endCursor === cursor)) {
      throw new Error('The saved scenario cursor did not advance. Reload and retry.');
    }
    cursor = page.hasNextPage ? page.endCursor : undefined;
  } while (cursor);
  return records.map(record => ({ ...record, data: parseSnapshot(record.snapshot) }));
}

export async function saveScenario(title: string, data: ScenarioSnapshot, id?: string) {
  if (!title.trim() || title.trim().length > 120) throw new Error('Use a scenario name of 1-120 characters.');
  const snapshot = JSON.stringify(data);
  parseSnapshot(snapshot);
  if (snapshot.length > 3900) throw new Error('Scenario snapshot exceeds the supported size.');
  const client = await getRayfinClient();
  const session = client.auth.getSession();
  if (!session.isAuthenticated || !session.user) throw new Error('Sign in before saving a scenario.');
  const values = { title: title.trim(), storeId: data.store.id, snapshot, updatedAt: new Date() };
  if (id) {
    await client.data.PromotionScenario.update({ id }, values);
  } else {
    await client.data.PromotionScenario.create({
      ...values, id: crypto.randomUUID(), createdAt: new Date(), owner_id: session.user.id,
    });
  }
}

export async function deleteScenario(id: string) {
  const client = await getRayfinClient();
  await client.data.PromotionScenario.delete({ id });
}
