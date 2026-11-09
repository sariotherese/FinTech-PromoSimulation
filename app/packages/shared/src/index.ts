/**
 * Browser-safe contracts shared by the data registration package and frontend.
 *
 * Keep each record shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */
export interface PromotionScenarioRecord {
  id: string;
  title: string;
  storeId: string;
  snapshot: string;
  createdAt: Date;
  updatedAt: Date;
  owner_id: string;
}

export type UniversalAppSchema = {
  PromotionScenario: PromotionScenarioRecord;
};

export * from './simulation.js';
