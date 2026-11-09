import { simulateCategories, type CategoryPlan, type ProductCategory, type Store } from '@rayfin-app/shared';

export interface HubPortfolioEntry {
  store: Store;
  plans: CategoryPlan[];
  hasDraft: boolean;
}

export type HubOrder = 'profit-desc' | 'revenue-desc' | 'profit-asc';

export function rankHubs(entries: HubPortfolioEntry[], city: string, category: ProductCategory | undefined, order: HubOrder) {
  return entries.filter(entry => !city || entry.store.city === city).map(entry => ({
    store: entry.store, hasDraft: entry.hasDraft,
    ...simulateCategories(entry.store, entry.plans, true, category),
  })).sort((left, right) => {
    const difference = order === 'revenue-desc' ? right.revenue - left.revenue
      : order === 'profit-asc' ? left.profit - right.profit : right.profit - left.profit;
    return difference || left.store.name.localeCompare(right.store.name) || left.store.id.localeCompare(right.store.id);
  });
}

export type RankedHub = ReturnType<typeof rankHubs>[number];
