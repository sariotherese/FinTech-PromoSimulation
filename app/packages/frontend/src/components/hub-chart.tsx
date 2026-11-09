import { useState } from 'react';
import { VegaVisual, useCssTheme, type VisualizationSpec } from '@microsoft/fabric-visuals';
import { readCssTheme, type DataTable } from '@microsoft/fabric-visuals-core';
import type { RankedHub } from '../lib/hub-priorities';

const spec: VisualizationSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  description: 'Partner hub revenue and projected profit, normalized to a 30-day origination cohort',
  mark: { type: 'bar', cornerRadiusEnd: 3 },
  encoding: {
    y: {
      field: 'hub', type: 'nominal', sort: { field: 'rank', op: 'min', order: 'ascending' },
      axis: { title: null, labelLimit: 190, labelOverlap: false },
    },
    yOffset: { field: 'measure', sort: ['Revenue', 'Projected profit'] },
    x: { field: 'amount', type: 'quantitative', axis: { title: 'PHP · 30-day cohort, lifetime economics', format: '~s' } },
    color: {
      field: 'measure', type: 'nominal', scale: { domain: ['Revenue', 'Projected profit'] },
      legend: { title: null, orient: 'top' },
    },
    tooltip: [
      { field: 'hub', type: 'nominal', title: 'Partner hub' },
      { field: 'city', type: 'nominal', title: 'City' },
      { field: 'measure', type: 'nominal', title: 'Measure' },
      { field: 'amount', type: 'quantitative', title: 'PHP', format: ',.0f' },
      { field: 'source', type: 'nominal', title: 'Source' },
    ],
  },
};

export function HubChart({ hubs }: { hubs: RankedHub[] }) {
  const rootTheme = useCssTheme();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const theme = container ? readCssTheme(container) : rootTheme;
  const data: DataTable = {
    columns: [{ name: 'hub' }, { name: 'city' }, { name: 'measure' }, { name: 'amount' }, { name: 'rank' }, { name: 'source' }],
    rows: hubs.flatMap((hub, index) => [
      [hub.store.name, hub.store.city, 'Revenue', hub.revenue, index + 1, hub.hasDraft ? 'Latest saved draft' : 'No-promo baseline'],
      [hub.store.name, hub.store.city, 'Projected profit', hub.profit, index + 1, hub.hasDraft ? 'Latest saved draft' : 'No-promo baseline'],
    ]),
  };
  return <div ref={setContainer} className="hub-chart">
    <VegaVisual spec={spec} data={data} theme={theme}
      capabilities={{ disableCategoricalScroll: true, disableDynamicAxisLabelOverlap: true, disableMinBarSize: true }}
      configVegaLite={{ range: { category: [theme.brandForeground, theme.foregroundSecondary] } }}
      style={{ height: Math.max(260, hubs.length * 64 + 96), width: '100%' }} />
  </div>;
}
