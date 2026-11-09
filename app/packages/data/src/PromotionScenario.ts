import { date, entity, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class PromotionScenario {
  @uuid() id!: string;
  @text({ min: 1, max: 120 }) title!: string;
  @text({ max: 80 }) storeId!: string;
  @text({ max: 3900 }) snapshot!: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @text({ max: 200 }) owner_id!: string;
}
