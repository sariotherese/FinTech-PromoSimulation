export const MODEL_VERSION = '1.1';
export const productCategories = ['Appliances', 'Mobile phones', 'Laptops', 'Electronics'] as const;
export type ProductCategory = typeof productCategories[number];

export function isProductCategory(value: unknown): value is ProductCategory {
  return productCategories.some(category => category === value);
}

export interface Store {
  id: string;
  name: string;
  city: string;
  category: string;
  monthlyLoans: number;
  ticket: number;
  currentPromo: string;
}

export interface Assumptions {
  days: number;
  term: number;
  annualInterest: number;
  discount: number;
  lenderShare: number;
  uplift: number;
  fee: number;
  partnerSubsidy: number;
  fundingRate: number;
  defaultRate: number;
  lossGivenDefault: number;
  costPerLoan: number;
  marketing: number;
  budget: number;
}

export const assumptionFields: {
  key: keyof Assumptions; label: string; min: number; max: number; step: number; unit: string;
}[] = [
  { key: 'days', label: 'Campaign duration', min: 1, max: 365, step: 1, unit: 'days' },
  { key: 'term', label: 'Loan term', min: 1, max: 36, step: 1, unit: 'months' },
  { key: 'annualInterest', label: 'Annual flat interest', min: 0, max: 100, step: 0.5, unit: '%' },
  { key: 'discount', label: 'Customer discount', min: 0, max: 80, step: 0.5, unit: '%' },
  { key: 'lenderShare', label: 'HC share of discount', min: 0, max: 100, step: 5, unit: '%' },
  { key: 'uplift', label: 'Assumed loan-volume uplift', min: -90, max: 300, step: 1, unit: '%' },
  { key: 'fee', label: 'Customer fee', min: 0, max: 20, step: 0.25, unit: '%' },
  { key: 'partnerSubsidy', label: 'Partner subsidy to HC', min: 0, max: 30, step: 0.5, unit: '%' },
  { key: 'fundingRate', label: 'Annual funding cost', min: 0, max: 50, step: 0.5, unit: '%' },
  { key: 'defaultRate', label: 'Lifetime probability of default', min: 0, max: 100, step: 0.5, unit: '%' },
  { key: 'lossGivenDefault', label: 'Loss given default', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'costPerLoan', label: 'Operating cost / loan', min: 0, max: 10000, step: 10, unit: 'PHP' },
  { key: 'marketing', label: 'Fixed campaign spend', min: 0, max: 10000000, step: 1000, unit: 'PHP' },
  { key: 'budget', label: 'Promotion budget cap', min: 0, max: 10000000, step: 1000, unit: 'PHP' },
];

export const defaultAssumptions: Assumptions = {
  days: 30, term: 6, annualInterest: 30, discount: 0, lenderShare: 50, uplift: 0,
  fee: 2, partnerSubsidy: 3, fundingRate: 8, defaultRate: 4, lossGivenDefault: 65,
  costPerLoan: 350, marketing: 0, budget: 150000,
};

export function validateAssumptions(a: Assumptions): string[] {
  return assumptionFields.flatMap(({ key, label, min, max }) => {
    const value = a[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      return [`${label} must be between ${min} and ${max}.`];
    }
    if ((key === 'term' || key === 'days') && !Number.isInteger(value)) {
      return [`${label} must be a whole number.`];
    }
    return [];
  });
}

export function validateStore(store: Store): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(store.ticket) || store.ticket <= 0) errors.push('Average ticket must be greater than zero.');
  if (!Number.isInteger(store.monthlyLoans) || store.monthlyLoans < 0) errors.push('Baseline monthly loans must be a nonnegative whole number.');
  return errors;
}

export function simulate(store: Store, a: Assumptions) {
  const errors = [...validateAssumptions(a), ...validateStore(store)];
  if (errors.length) throw new Error(errors.join(' '));
  const loans = Math.round(store.monthlyLoans * a.days / 30 * (1 + a.uplift / 100));
  const sales = loans * store.ticket;
  const discount = sales * a.discount / 100;
  const principal = sales - discount;
  const interest = principal * a.annualInterest / 100 * a.term / 12;
  const fees = principal * a.fee / 100;
  const subsidy = principal * a.partnerSubsidy / 100;
  const revenue = interest + fees + subsidy;
  const funding = principal * 0.5 * a.fundingRate / 100 * a.term / 12;
  const creditLoss = principal * a.defaultRate / 100 * a.lossGivenDefault / 100;
  const operating = loans * a.costPerLoan;
  const discountCost = discount * a.lenderShare / 100;
  const promoSpend = discountCost + a.marketing;
  const expenses = funding + creditLoss + operating + promoSpend;
  const profit = revenue - expenses;
  const contributionPerLoan = loans ? (revenue - funding - creditLoss - operating - discountCost) / loans : 0;
  return {
    loans, sales, principal, interest, fees, subsidy, revenue, funding, creditLoss,
    operating, discountCost, promoSpend, expenses, profit,
    loss: Math.max(0, -profit), margin: revenue ? profit / revenue * 100 : null,
    budgetRemaining: a.budget - promoSpend,
    breakEvenLoans: contributionPerLoan > 0 ? Math.ceil(a.marketing / contributionPerLoan) : null,
  };
}

export function baselineFor(a: Assumptions): Assumptions {
  return { ...a, annualInterest: defaultAssumptions.annualInterest,
    discount: 0, uplift: 0, marketing: 0 };
}

export interface ScenarioSnapshot {
  version: typeof MODEL_VERSION;
  store: Store;
  categoryPlans: CategoryPlan[];
}

export interface CategoryPlan {
  category: ProductCategory;
  monthlyLoans: number;
  ticket: number;
  assumptions: Assumptions;
}

export function createCategoryPlans(store: Store, assumptions = defaultAssumptions): CategoryPlan[] {
  const primary = isProductCategory(store.category) ? store.category : 'Electronics';
  const share = Math.floor(store.monthlyLoans / productCategories.length);
  return productCategories.map(category => ({
    category, monthlyLoans: category === primary ? store.monthlyLoans - share * 3 : share,
    ticket: store.ticket,
    assumptions: { ...assumptions, marketing: assumptions.marketing / 4, budget: assumptions.budget / 4 },
  }));
}

export function validateCategoryPlans(store: Store, plans: CategoryPlan[]): string[] {
  const errors: string[] = [];
  if (plans.length !== 4 || new Set(plans.map(plan => plan.category)).size !== 4 ||
      plans.some(plan => !isProductCategory(plan.category))) {
    errors.push('Include exactly one plan for each of the four product categories.');
  }
  for (const plan of plans) {
    errors.push(...[...validateStore({ ...store, ...plan }), ...validateAssumptions(plan.assumptions)]
      .map(error => `${plan.category}: ${error}`));
  }
  return errors;
}

export function simulateCategory(store: Store, plan: CategoryPlan, baseline = false) {
  return simulate({ ...store, monthlyLoans: plan.monthlyLoans, ticket: plan.ticket },
    baseline ? baselineFor(plan.assumptions) : plan.assumptions);
}

export function simulateCategories(store: Store, plans: CategoryPlan[], normalizeTo30Days = false, category?: ProductCategory) {
  const errors = validateCategoryPlans(store, plans);
  if (errors.length) throw new Error(errors.join(' '));
  const totals = plans.filter(plan => !category || plan.category === category).reduce((total, plan) => {
    const result = simulateCategory(store, plan);
    const scale = normalizeTo30Days ? 30 / plan.assumptions.days : 1;
    return {
      loans: total.loans + result.loans * scale, revenue: total.revenue + result.revenue * scale,
      profit: total.profit + result.profit * scale, promoSpend: total.promoSpend + result.promoSpend * scale,
      budget: total.budget + plan.assumptions.budget * scale,
    };
  }, { loans: 0, revenue: 0, profit: 0, promoSpend: 0, budget: 0 });
  return { ...totals, loss: Math.max(0, -totals.profit), budgetRemaining: totals.budget - totals.promoSpend };
}

function readAssumptions(raw: unknown): Assumptions {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid stored assumptions.');
  const number = (key: keyof Assumptions): number => {
    const value: unknown = Reflect.get(raw, key);
    if (typeof value !== 'number') throw new Error(`Missing or invalid scenario field: ${key}`);
    return value;
  };
  const values: Assumptions = {
    days: number('days'), term: number('term'), annualInterest: number('annualInterest'),
    discount: number('discount'), lenderShare: number('lenderShare'), uplift: number('uplift'),
    fee: number('fee'), partnerSubsidy: number('partnerSubsidy'), fundingRate: number('fundingRate'),
    defaultRate: number('defaultRate'), lossGivenDefault: number('lossGivenDefault'),
    costPerLoan: number('costPerLoan'), marketing: number('marketing'), budget: number('budget'),
  };
  const errors = validateAssumptions(values);
  if (errors.length) throw new Error(errors.join(' '));
  return values;
}

export function parseSnapshot(json: string): ScenarioSnapshot {
  const raw: unknown = JSON.parse(json);
  if (!raw || typeof raw !== 'object' || !('version' in raw) ||
      (raw.version !== MODEL_VERSION && raw.version !== '1.0') || !('store' in raw)) {
    throw new Error('Unsupported scenario snapshot. Recreate it with the current model.');
  }
  const store = raw.store;
  if (!store || typeof store !== 'object' ||
      !('id' in store) || typeof store.id !== 'string' ||
      !('name' in store) || typeof store.name !== 'string' ||
      !('city' in store) || typeof store.city !== 'string' ||
      !('category' in store) || typeof store.category !== 'string' ||
      !('monthlyLoans' in store) || typeof store.monthlyLoans !== 'number' ||
      !('ticket' in store) || typeof store.ticket !== 'number' ||
      !('currentPromo' in store) || typeof store.currentPromo !== 'string') {
    throw new Error('Invalid stored scenario data.');
  }
  const checkedStore: Store = {
    id: store.id, name: store.name, city: store.city, category: store.category,
    monthlyLoans: store.monthlyLoans, ticket: store.ticket, currentPromo: store.currentPromo,
  };
  const storeErrors = validateStore(checkedStore);
  if (storeErrors.length) throw new Error(storeErrors.join(' '));
  let categoryPlans: CategoryPlan[];
  if (raw.version === '1.0') {
    if (!('assumptions' in raw) || !isProductCategory(checkedStore.category)) {
      throw new Error('Invalid legacy scenario category or assumptions.');
    }
    const assumptions = readAssumptions(raw.assumptions);
    categoryPlans = productCategories.map(category => ({
      category, monthlyLoans: category === checkedStore.category ? checkedStore.monthlyLoans : 0,
      ticket: checkedStore.ticket,
      assumptions: category === checkedStore.category ? { ...assumptions } : { ...assumptions, marketing: 0, budget: 0 },
    }));
  } else {
    if (!('categoryPlans' in raw) || !Array.isArray(raw.categoryPlans)) throw new Error('Missing category plans.');
    categoryPlans = raw.categoryPlans.map((plan: unknown) => {
      if (!plan || typeof plan !== 'object' ||
          !('category' in plan) || !isProductCategory(plan.category) ||
          !('monthlyLoans' in plan) || typeof plan.monthlyLoans !== 'number' ||
          !('ticket' in plan) || typeof plan.ticket !== 'number' || !('assumptions' in plan)) {
        throw new Error('Invalid stored category plan.');
      }
      return { category: plan.category, monthlyLoans: plan.monthlyLoans, ticket: plan.ticket,
        assumptions: readAssumptions(plan.assumptions) };
    });
  }
  const errors = validateCategoryPlans(checkedStore, categoryPlans);
  if (errors.length) throw new Error(errors.join(' '));
  return { version: MODEL_VERSION, store: checkedStore, categoryPlans };
}
