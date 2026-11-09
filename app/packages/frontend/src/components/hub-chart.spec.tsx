import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VegaVisual } from '@microsoft/fabric-visuals';
import { isDataTable } from '@microsoft/fabric-visuals-core';
import { createCategoryPlans } from '@rayfin-app/shared';
import { stores } from '../lib/demo-data';
import { rankHubs } from '../lib/hub-priorities';
import { HubChart } from './hub-chart';

vi.mock('@microsoft/fabric-visuals', async importOriginal => {
  const original = await importOriginal<typeof import('@microsoft/fabric-visuals')>();
  return { ...original, VegaVisual: vi.fn(() => <div>Hub chart renderer</div>) };
});

describe('hub chart', () => {
  it('passes all 51 hubs and both measures without chart-library categorical slicing', () => {
    const hubs = rankHubs(stores.map(store => ({ store, plans: createCategoryPlans(store), hasDraft: false })),
      '', undefined, 'profit-desc');
    render(<HubChart hubs={hubs} />);
    const props = vi.mocked(VegaVisual).mock.lastCall?.[0];
    expect(props?.capabilities).toMatchObject({ disableCategoricalScroll: true, disableDynamicAxisLabelOverlap: true, disableMinBarSize: true });
    if (!props?.data || !isDataTable(props.data)) throw new Error('Expected a typed hub data table.');
    expect(props.data.rows).toHaveLength(102);
    expect(props.data.rows[0]).toEqual([hubs[0].store.name, hubs[0].store.city, 'Revenue', hubs[0].revenue, 1, 'No-promo baseline']);
    expect(props.data.rows[1]).toEqual([hubs[0].store.name, hubs[0].store.city, 'Projected profit', hubs[0].profit, 1, 'No-promo baseline']);
  });
});
