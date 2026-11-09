import { defaultAssumptions, isProductCategory, productCategories, type CategoryPlan, type ProductCategory, type Store } from '@rayfin-app/shared';

export const cities = [
  { name: 'Caloocan', lat: 14.651, lon: 120.984 },
  { name: 'Las Pinas', lat: 14.445, lon: 120.994 },
  { name: 'Makati', lat: 14.554, lon: 121.024 },
  { name: 'Malabon', lat: 14.669, lon: 120.956 },
  { name: 'Mandaluyong', lat: 14.583, lon: 121.039 },
  { name: 'Manila', lat: 14.599, lon: 120.984 },
  { name: 'Marikina', lat: 14.650, lon: 121.102 },
  { name: 'Muntinlupa', lat: 14.408, lon: 121.041 },
  { name: 'Navotas', lat: 14.659, lon: 120.940 },
  { name: 'Paranaque', lat: 14.479, lon: 121.019 },
  { name: 'Pasay', lat: 14.537, lon: 121.001 },
  { name: 'Pasig', lat: 14.576, lon: 121.085 },
  { name: 'Pateros', lat: 14.545, lon: 121.068 },
  { name: 'Quezon City', lat: 14.677, lon: 121.043 },
  { name: 'San Juan', lat: 14.602, lon: 121.035 },
  { name: 'Taguig', lat: 14.517, lon: 121.061 },
  { name: 'Valenzuela', lat: 14.706, lon: 120.978 },
] as const;

// Keyed draws keep the fictional dataset repeatable and independent of iteration order.
function sample(key: string) {
  let hash = 2166136261;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  return (hash >>> 0) / 4294967296;
}

function between(key: string, min: number, max: number, step = 1) {
  return min + Math.floor(sample(key) * (Math.floor((max - min) / step) + 1)) * step;
}

const profiles: Record<ProductCategory, {
  ticket: [number, number]; terms: number[]; defaultRate: [number, number];
  fee: [number, number]; subsidy: [number, number]; cost: [number, number]; lgd: [number, number];
}> = {
  Appliances: { ticket: [22000, 62000], terms: [6, 9, 12], defaultRate: [2, 5.5],
    fee: [1, 2.5], subsidy: [2, 5], cost: [300, 580], lgd: [50, 70] },
  'Mobile phones': { ticket: [7500, 36000], terms: [3, 6, 9], defaultRate: [4, 10],
    fee: [0.5, 2], subsidy: [0.5, 2.5], cost: [240, 480], lgd: [65, 80] },
  Laptops: { ticket: [28000, 85000], terms: [6, 9, 12], defaultRate: [2.5, 7],
    fee: [0.75, 2.5], subsidy: [1, 3.5], cost: [320, 620], lgd: [55, 75] },
  Electronics: { ticket: [9500, 42000], terms: [3, 6, 9], defaultRate: [3, 8],
    fee: [0.5, 2.5], subsidy: [0.5, 3.5], cost: [220, 520], lgd: [55, 75] },
};

const mix: Record<ProductCategory, Record<ProductCategory, number>> = {
  Appliances: { Appliances: 0.64, 'Mobile phones': 0.1, Laptops: 0.08, Electronics: 0.18 },
  'Mobile phones': { Appliances: 0.08, 'Mobile phones': 0.67, Laptops: 0.1, Electronics: 0.15 },
  Laptops: { Appliances: 0.1, 'Mobile phones': 0.18, Laptops: 0.55, Electronics: 0.17 },
  Electronics: { Appliances: 0.18, 'Mobile phones': 0.28, Laptops: 0.27, Electronics: 0.27 },
};

export function createDemoCategoryPlans(store: Pick<Store, 'id' | 'category' | 'monthlyLoans'>): CategoryPlan[] {
  if (!isProductCategory(store.category) || !Number.isInteger(store.monthlyLoans) || store.monthlyLoans < 0) {
    throw new Error('Cannot generate demo plans for an invalid store category or loan volume.');
  }
  const primary = store.category;
  const weights = productCategories.map(category => mix[primary][category] * (0.75 + sample(`${store.id}:${category}:mix`) * 0.5));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const exactVolumes = weights.map(weight => store.monthlyLoans * weight / weightTotal);
  const volumes = exactVolumes.map(Math.floor);
  // Largest remainders preserve the hub's total volume without favoring the final category.
  const remainders = exactVolumes.map((volume, index) => ({ index, fraction: volume - volumes[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  const remaining = store.monthlyLoans - volumes.reduce((sum, volume) => sum + volume, 0);
  for (const item of remainders.slice(0, remaining)) volumes[item.index]++;

  return productCategories.map((category, index) => {
    const profile = profiles[category];
    const key = `${store.id}:${category}`;
    const ticket = between(`${key}:ticket`, ...profile.ticket, 100);
    const monthlyLoans = volumes[index];
    return {
      category, monthlyLoans, ticket,
      assumptions: {
        ...defaultAssumptions,
        term: profile.terms[Math.floor(sample(`${key}:term`) * profile.terms.length)],
        fee: between(`${key}:fee`, ...profile.fee, 0.25),
        partnerSubsidy: between(`${key}:subsidy`, ...profile.subsidy, 0.5),
        fundingRate: between(`${key}:funding`, 7.5, 11.5, 0.5),
        defaultRate: between(`${key}:default`, ...profile.defaultRate, 0.5),
        lossGivenDefault: between(`${key}:lgd`, ...profile.lgd, 5),
        costPerLoan: between(`${key}:cost`, ...profile.cost, 10),
        lenderShare: between(`${key}:discount-share`, 30, 70, 5),
        budget: Math.max(5000, Math.round(monthlyLoans * ticket * between(`${key}:budget-rate`, 2, 6, 0.5) / 100 / 1000) * 1000),
      },
    };
  });
}

const formats: { name: string; category: ProductCategory; volume: [number, number] }[] = [
  { name: 'Digital Hub', category: 'Electronics', volume: [80, 260] },
  { name: 'Home Living', category: 'Appliances', volume: [45, 180] },
  { name: 'Mobile Corner', category: 'Mobile phones', volume: [120, 420] },
];
const referencePromos = ['No campaign', 'No campaign', 'Demo payday offer', 'Demo 0% installment tag', 'Demo partner discount tag'];

export const stores: Store[] = cities.flatMap((city, c) =>
  formats.map((format, f) => {
    const id = `demo-${c + 1}-${f + 1}`;
    const monthlyLoans = Math.round(between(`${id}:volume`, ...format.volume) *
      between(`${city.name}:retail-activity`, 0.8, 1.3, 0.05));
    const identity = {
      id, name: `${city.name} ${format.name}`, city: city.name, category: format.category, monthlyLoans,
      currentPromo: referencePromos[Math.floor(sample(`${id}:reference-promo`) * referencePromos.length)],
    };
    const plans = createDemoCategoryPlans(identity);
    const ticket = Math.round(plans.reduce((sum, plan) => sum + plan.monthlyLoans * plan.ticket, 0) / monthlyLoans / 100) * 100;
    return { ...identity, ticket };
  }),
);
