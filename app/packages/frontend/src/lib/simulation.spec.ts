import { describe, expect, it } from 'vitest';
import {
  baselineFor, createCategoryPlans, defaultAssumptions, MODEL_VERSION, parseSnapshot, productCategories,
  simulate, simulateCategories, simulateCategory, validateAssumptions, type Store,
} from '@rayfin-app/shared';
import { cities, stores } from './demo-data';
import geography from './metro-map.json';

const store: Store = {
  id: 'test', name: 'Test Store', city: 'Makati', category: 'Electronics',
  monthlyLoans: 100, ticket: 20000, currentPromo: 'No campaign',
};

describe('promotion lifetime economics', () => {
  it('reconciles an independently calculated no-promo cohort', () => {
    const r = simulate(store, defaultAssumptions);
    expect(r.loans).toBe(100);
    expect(r.principal).toBe(2000000);
    expect(r.interest).toBe(300000);
    expect(r.fees).toBe(40000);
    expect(r.subsidy).toBe(60000);
    expect(r.revenue).toBe(400000);
    expect(r.funding).toBe(40000);
    expect(r.creditLoss).toBe(52000);
    expect(r.operating).toBe(35000);
    expect(r.profit).toBe(273000);
    expect(r.loss).toBe(0);
  });
  it('models zero interest as forgone revenue, not a second promotion expense', () => {
    const r = simulate(store, { ...defaultAssumptions, annualInterest: 0 });
    expect(r.revenue).toBe(100000);
    expect(r.promoSpend).toBe(0);
    expect(r.profit).toBe(-27000);
    expect(r.loss).toBe(27000);
    expect(r.breakEvenLoans).toBeNull();
  });
  it('accounts for discounted principal and only HC share of the discount', () => {
    const r = simulate(store, { ...defaultAssumptions, discount: 10, uplift: 25, marketing: 15000 });
    expect(r.loans).toBe(125);
    expect(r.principal).toBe(2250000);
    expect(r.discountCost).toBe(125000);
    expect(r.promoSpend).toBe(140000);
    expect(r.profit).toBe(162750);
    expect(r.budgetRemaining).toBe(10000);
    expect(r.profit).toBeCloseTo(r.revenue - r.expenses);
  });
  it('retains shared costs and risk but resets promotion levers in the baseline', () => {
    const inputs = { ...defaultAssumptions, term: 12, defaultRate: 10, discount: 20,
      annualInterest: 0, uplift: 30, marketing: 10000 };
    const base = baselineFor(inputs);
    expect(base).toEqual({ ...inputs, discount: 0, annualInterest: 30, uplift: 0, marketing: 0 });
  });
  it('scales campaign cohorts without multiplying loan-term revenue twice', () => {
    const month = simulate(store, defaultAssumptions);
    const twoMonths = simulate(store, { ...defaultAssumptions, days: 60 });
    expect(twoMonths.revenue).toBe(month.revenue * 2);
    expect(twoMonths.profit).toBe(month.profit * 2);
  });
  it('handles no volume and zero revenue without NaN or infinite margins', () => {
    const r = simulate({ ...store, monthlyLoans: 0 }, defaultAssumptions);
    expect(r.margin).toBeNull();
    expect(r.profit).toBe(0);
    expect(r.breakEvenLoans).toBeNull();
  });
  it.each([{ discount: -1 }, { uplift: 301 }, { term: 1.5 }, { days: 0 },
    { fundingRate: NaN }, { budget: Infinity }])('rejects invalid assumptions: %j', patch => {
    const inputs = { ...defaultAssumptions, ...patch };
    expect(validateAssumptions(inputs).length).toBeGreaterThan(0);
    expect(() => simulate(store, inputs)).toThrow();
  });
  it('reports budget overruns and losses without clipping them into success', () => {
    const r = simulate(store, { ...defaultAssumptions, annualInterest: 0, marketing: 200000, budget: 10000 });
    expect(r.budgetRemaining).toBe(-190000);
    expect(r.loss).toBe(227000);
  });
  it('round-trips an immutable versioned input snapshot', () => {
    const data = { version: MODEL_VERSION, store, categoryPlans: createCategoryPlans(store) };
    expect(parseSnapshot(JSON.stringify(data))).toEqual(data);
    expect(() => parseSnapshot('{"version":"future"}')).toThrow();
    expect(() => parseSnapshot(JSON.stringify({ ...data, categoryPlans: [{ category: 'Appliances', assumptions: { discount: 10 } }] }))).toThrow();
  });

  describe('category planning', () => {
    it('covers four categories without inflating store volume, revenue, profit or budget', () => {
      const plans = createCategoryPlans(store);
      expect(plans.map(plan => plan.category)).toEqual(productCategories);
      const total = simulateCategories(store, plans);
      expect(total.loans).toBe(100);
      expect(total.revenue).toBeCloseTo(400000);
      expect(total.profit).toBeCloseTo(273000);
      expect(total.budget).toBe(150000);
      expect(plans.reduce((sum, plan) => sum + plan.monthlyLoans, 0)).toBe(store.monthlyLoans);
    });
    it('increases appliance volume independently and charges its fixed spend once', () => {
      const plans = createCategoryPlans(store);
      const otherBefore = simulateCategory(store, plans[1]);
      plans[0].monthlyLoans += 10;
      plans[0].assumptions.marketing = 10000;
      expect(simulateCategory(store, plans[0]).profit).toBe(85550);
      expect(simulateCategory(store, plans[1])).toEqual(otherBefore);
      expect(simulateCategories(store, plans).profit).toBe(290300);
      expect(simulateCategories(store, plans).promoSpend).toBe(10000);
    });
    it('normalizes each category duration independently for overview roll-ups', () => {
      const plans = createCategoryPlans(store);
      plans[0].assumptions.days = 60;
      expect(simulateCategories(store, plans).revenue).toBe(500000);
      expect(simulateCategories(store, plans, true).revenue).toBe(400000);
      expect(simulateCategories(store, plans, true, 'Appliances').revenue).toBe(100000);
    });
    it('preserves legacy financial outputs, volume and spend without inventing other category sales', () => {
      const assumptions = { ...defaultAssumptions, days: 45, discount: 10, uplift: 25, marketing: 15000 };
      const legacy = { version: '1.0', store, assumptions };
      const migrated = parseSnapshot(JSON.stringify(legacy));
      const expected = simulate(store, assumptions);
      expect(migrated.version).toBe(MODEL_VERSION);
      expect(migrated.categoryPlans).toHaveLength(4);
      expect(migrated.categoryPlans.filter(plan => plan.category !== 'Electronics').every(plan => plan.monthlyLoans === 0)).toBe(true);
      expect(simulateCategories(store, migrated.categoryPlans)).toMatchObject({
        revenue: expected.revenue, profit: expected.profit, promoSpend: expected.promoSpend,
        budget: assumptions.budget, loans: expected.loans,
      });
    });
    it('rejects missing, duplicate and invalid category inputs and fits the stored snapshot limit', () => {
      const categoryPlans = createCategoryPlans(store);
      const data = { version: MODEL_VERSION, store, categoryPlans };
      expect(JSON.stringify(data).length).toBeLessThanOrEqual(3900);
      expect(() => parseSnapshot(JSON.stringify({ ...data, categoryPlans: categoryPlans.slice(1) }))).toThrow();
      expect(() => parseSnapshot(JSON.stringify({ ...data, categoryPlans: categoryPlans.map(() => categoryPlans[0]) }))).toThrow();
      categoryPlans[0].monthlyLoans = -1;
      expect(() => parseSnapshot(JSON.stringify(data))).toThrow();
      expect(() => simulateCategories(store, categoryPlans)).toThrow();
    });
  });
});

describe('Metro Manila demo coverage', () => {
  it('retains detailed coastlines and fits all projected boundaries inside the map', () => {
    const points = geography.paths.flatMap(city => [...city.path.matchAll(/[ML]([\d.]+),([\d.]+)/g)]);
    expect(points.length).toBeGreaterThan(3000);
    for (const point of points) {
      expect(Number(point[1])).toBeGreaterThanOrEqual(55);
      expect(Number(point[1])).toBeLessThanOrEqual(485);
      expect(Number(point[2])).toBeGreaterThanOrEqual(27.5);
      expect(Number(point[2])).toBeLessThanOrEqual(537.5);
    }
    expect(geography.longitudeScale).toBeCloseTo(Math.cos(14.6 * Math.PI / 180), 2);
  });
  it('covers exactly 17 matching geographic LGUs and three fictional stores each', () => {
    expect(cities).toHaveLength(17);
    expect(geography.paths).toHaveLength(17);
    expect(stores).toHaveLength(51);
    expect(new Set(stores.map(s => s.id)).size).toBe(51);
    for (const city of cities) {
      expect(geography.paths.some(path => path.name === city.name)).toBe(true);
      expect(stores.filter(s => s.city === city.name)).toHaveLength(3);
    }
  });
});
