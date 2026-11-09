import { useState } from 'react';
import { VegaVisual, useCssTheme, type VisualizationSpec } from '@microsoft/fabric-visuals';
import { readCssTheme, type DataTable } from '@microsoft/fabric-visuals-core';
import type { simulate } from '@rayfin-app/shared';

const spec: VisualizationSpec = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  description: 'Baseline and proposed lifetime economics in Philippine pesos',
  mark: { type: 'bar', cornerRadiusEnd: 3 },
  encoding: {
    y: { field: 'measure', type: 'nominal', sort: null, axis: { title: null } },
    x: { field: 'amount', type: 'quantitative', axis: { title: 'PHP · lifetime of loan cohort', format: '~s' } },
    tooltip: [
      { field: 'measure', type: 'nominal', title: 'Measure' },
      { field: 'amount', type: 'quantitative', format: ',.0f', title: 'PHP' },
    ],
  },
};

export function EconomicsChart({ baseline, proposed }: {
  baseline: ReturnType<typeof simulate>; proposed: ReturnType<typeof simulate>;
}) {
  const rootTheme = useCssTheme();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const theme = container ? readCssTheme(container) : rootTheme;
  const data: DataTable = {
    columns: [{ name: 'measure' }, { name: 'amount' }],
    rows: [
      ['Baseline revenue', baseline.revenue], ['Draft revenue', proposed.revenue],
      ['Baseline profit', baseline.profit], ['Draft profit', proposed.profit],
    ],
  };
  return <div ref={setContainer}><VegaVisual spec={spec} data={data} theme={theme} style={{ height: 210, width: '100%' }} /></div>;
}
