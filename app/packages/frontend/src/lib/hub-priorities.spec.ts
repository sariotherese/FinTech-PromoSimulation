import { describe, expect, it } from 'vitest';
import { createCategoryPlans, type Store } from '@rayfin-app/shared';
import { rankHubs, type HubPortfolioEntry } from './hub-priorities';
import { stores } from './demo-data';

function entry(name: string, city: string, monthlyLoans: number, ticket: number): HubPortfolioEntry {
  const store: Store = { id: name, name, city, monthlyLoans, ticket, category: 'Electronics', currentPromo: 'No campaign' };
  return { store, plans: createCategoryPlans(store), hasDraft: false };
}

describe('hub prioritization', () => {
  it('includes every hub in a city and all 51 hubs without a city filter', () => {
    const entries = stores.map(store => ({ store, plans: createCategoryPlans(store), hasDraft: false }));
    expect(rankHubs(entries, 'Makati', undefined, 'profit-desc')).toHaveLength(3);
    expect(rankHubs(entries, '', undefined, 'profit-desc')).toHaveLength(51);
    expect(rankHubs(entries, 'Pasig', undefined, 'profit-desc').every(hub => hub.store.city === 'Pasig')).toBe(true);
  });
  it('ranks by either revenue or profit and retains losses instead of clipping them', () => {
    const first = entry('A', 'Makati', 100, 20000);
    const second = entry('B', 'Makati', 200, 20000);
    second.hasDraft = true;
    for (const plan of second.plans) plan.assumptions.annualInterest = 0;
    expect(rankHubs([first, second], 'Makati', undefined, 'profit-desc').map(hub => hub.store.id)).toEqual(['A', 'B']);
    expect(rankHubs([first, second], 'Makati', undefined, 'profit-asc')[0]).toMatchObject({ profit: -54000, hasDraft: true });
    for (const plan of second.plans) plan.assumptions.fee = 10;
    expect(rankHubs([first, second], 'Makati', undefined, 'revenue-desc')[0].store.id).toBe('B');
    expect(rankHubs([first, second], 'Makati', undefined, 'profit-desc')[0].store.id).toBe('A');
  });
  it('normalizes each saved category cohort and applies the category filter consistently', () => {
    const hub = entry('A', 'Makati', 100, 20000);
    hub.plans[0].assumptions.days = 60;
    expect(rankHubs([hub], 'Makati', undefined, 'profit-desc')[0]).toMatchObject({ revenue: 400000, profit: 273000 });
    expect(rankHubs([hub], 'Makati', 'Appliances', 'profit-desc')[0]).toMatchObject({ revenue: 100000, profit: 68250 });
  });
  it('uses a deterministic name tie-break and does not mutate the source entries', () => {
    const entries = [entry('Z', 'Makati', 100, 20000), entry('A', 'Makati', 100, 20000)];
    expect(rankHubs(entries, 'Makati', undefined, 'profit-desc').map(hub => hub.store.name)).toEqual(['A', 'Z']);
    expect(entries.map(hub => hub.store.name)).toEqual(['Z', 'A']);
    expect(rankHubs(entries, 'Pasig', undefined, 'profit-desc')).toEqual([]);
  });
});
