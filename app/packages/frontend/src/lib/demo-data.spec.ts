import { describe, expect, it } from 'vitest';
import { MODEL_VERSION, parseSnapshot, productCategories, simulateCategories, simulateCategory, validateCategoryPlans } from '@rayfin-app/shared';
import { createDemoCategoryPlans, stores } from './demo-data';

describe('varied synthetic retail profiles', () => {
  it('is repeatable, returns independent editable copies, and conserves each hub volume', () => {
    for (const store of stores) {
      const plans = createDemoCategoryPlans(store);
      expect(plans).toEqual(createDemoCategoryPlans({ ...store }));
      expect(plans.map(plan => plan.category)).toEqual(productCategories);
      expect(plans.reduce((sum, plan) => sum + plan.monthlyLoans, 0)).toBe(store.monthlyLoans);
      expect(plans.every(plan => Number.isInteger(plan.monthlyLoans) && plan.monthlyLoans > 0)).toBe(true);
      expect(validateCategoryPlans(store, plans)).toEqual([]);
      plans[0].assumptions.discount = 50;
      plans[0].monthlyLoans = 0;
      expect(createDemoCategoryPlans(store)[0].assumptions.discount).toBe(0);
      expect(createDemoCategoryPlans(store)[0].monthlyLoans).toBeGreaterThan(0);
    }
  });
  it('has materially different category prices, volumes, terms, costs, risks and profit', () => {
    const plans = stores.flatMap(createDemoCategoryPlans);
    expect(new Set(stores.map(store => store.monthlyLoans)).size).toBeGreaterThanOrEqual(40);
    const priceRanges = {
      Appliances: [22000, 62000], 'Mobile phones': [7500, 36000],
      Laptops: [28000, 85000], Electronics: [9500, 42000],
    };
    for (const category of productCategories) {
      const values = plans.filter(plan => plan.category === category);
      expect(new Set(values.map(plan => plan.ticket)).size).toBeGreaterThanOrEqual(35);
      expect(new Set(values.map(plan => plan.assumptions.term)).size).toBe(3);
      expect(new Set(values.map(plan => plan.assumptions.costPerLoan)).size).toBeGreaterThan(10);
      expect(new Set(values.map(plan => plan.assumptions.defaultRate)).size).toBeGreaterThan(5);
      for (const plan of values) {
        expect(plan.ticket).toBeGreaterThanOrEqual(priceRanges[category][0]);
        expect(plan.ticket).toBeLessThanOrEqual(priceRanges[category][1]);
        expect(plan.assumptions.budget).toBeGreaterThanOrEqual(5000);
      }
    }
    const results = stores.map(store => ({ store, plans: createDemoCategoryPlans(store) }));
    expect(new Set(results.map(({ store, plans }) => simulateCategories(store, plans).profit)).size).toBe(51);
    expect(results.some(({ store, plans }) => plans.some(plan => simulateCategory(store, plan).profit < 0))).toBe(true);
    for (const { store, plans } of results) {
      expect(new Set(plans.map(plan => plan.ticket)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(plans.map(plan => simulateCategory(store, plan).revenue)).size).toBe(4);
    }
  });
  it('makes each store format specialize in a plausible product mix and reconciles its average ticket', () => {
    for (const store of stores) {
      const plans = createDemoCategoryPlans(store);
      const largest = [...plans].sort((a, b) => b.monthlyLoans - a.monthlyLoans)[0];
      if (store.category !== 'Electronics') expect(largest.category).toBe(store.category);
      const weightedTicket = plans.reduce((sum, plan) => sum + plan.monthlyLoans * plan.ticket, 0) / store.monthlyLoans;
      expect(Math.abs(store.ticket - weightedTicket)).toBeLessThanOrEqual(50);
      const data = { version: MODEL_VERSION, store, categoryPlans: plans };
      expect(JSON.stringify(data).length).toBeLessThanOrEqual(3900);
      expect(parseSnapshot(JSON.stringify(data))).toEqual(data);
    }
  });
  it('handles zero/small volumes without losing loans and rejects invalid generator inputs', () => {
    const template = stores[0];
    for (const monthlyLoans of [0, 1, 2, 3, 5]) {
      const plans = createDemoCategoryPlans({ ...template, monthlyLoans });
      expect(plans.reduce((sum, plan) => sum + plan.monthlyLoans, 0)).toBe(monthlyLoans);
      expect(plans.every(plan => Number.isInteger(plan.monthlyLoans) && plan.monthlyLoans >= 0)).toBe(true);
    }
    expect(() => createDemoCategoryPlans({ ...template, category: 'Unknown' })).toThrow();
    expect(() => createDemoCategoryPlans({ ...template, monthlyLoans: NaN })).toThrow();
    expect(() => createDemoCategoryPlans({ ...template, monthlyLoans: 1.5 })).toThrow();
  });
});
