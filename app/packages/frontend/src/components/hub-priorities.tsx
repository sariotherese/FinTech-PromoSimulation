import { lazy, Suspense, useState } from 'react';
import { isProductCategory, productCategories, type ProductCategory, type Store } from '@rayfin-app/shared';
import { cities } from '../lib/demo-data';
import { rankHubs, type HubOrder, type HubPortfolioEntry } from '../lib/hub-priorities';

const HubChart = lazy(() => import('./hub-chart').then(module => ({ default: module.HubChart })));
const php = (value: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 0,
}).format(value);

export function HubPriorities({ entries, initialCity, selectedStoreId, onPlan }: {
  entries: HubPortfolioEntry[];
  initialCity: string;
  selectedStoreId: string;
  onPlan: (store: Store, category?: ProductCategory) => void;
}) {
  const [city, setCity] = useState(initialCity);
  const [category, setCategory] = useState<ProductCategory>();
  const [order, setOrder] = useState<HubOrder>('profit-desc');
  const hubs = rankHubs(entries, city, category, order);
  return <section className="panel hub-priorities" aria-label="Partner hub prioritization">
    <div className="panel-heading"><div><h2>Find your next partner opportunity</h2>
      <p>Compare every partner hub in a city before choosing where to plan a promotion.</p></div>
      <span className="pill">{hubs.length} partner hubs</span></div>
    <div className="hub-filters">
      <label className="field">City<select aria-label="Hub city filter" value={city} onChange={event => setCity(event.target.value)}>
        <option value="">All Metro Manila cities</option>{cities.map(value => <option key={value.name}>{value.name}</option>)}
      </select></label>
      <label className="field">Product category<select aria-label="Hub category filter" value={category ?? ''} onChange={event => {
        const value = event.target.value;
        if (value === '' || isProductCategory(value)) setCategory(value || undefined);
      }}><option value="">All categories</option>{productCategories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Prioritize by<select aria-label="Hub ranking" value={order} onChange={event => {
        const value = event.target.value;
        if (value === 'profit-desc' || value === 'revenue-desc' || value === 'profit-asc') setOrder(value);
      }}><option value="profit-desc">Highest projected profit</option><option value="revenue-desc">Highest revenue</option>
        <option value="profit-asc">Lowest projected profit</option></select></label>
    </div>
    <p className="hint">Latest saved draft per hub; no-promo baseline where no draft exists. Each category is normalized to a 30-day
      origination cohort; figures are lifetime loan economics, not monthly accounting income. Unsaved editor changes are excluded.</p>
    {hubs.length ? <>
      <div className="hub-chart-scroll" role="region" aria-label="Partner hub revenue and profit bar graph" tabIndex={0}>
        <Suspense fallback={<p role="status">Loading partner hub chart…</p>}><HubChart hubs={hubs} /></Suspense>
      </div>
      <div className="table-scroll hub-table"><table aria-label="Ranked partner hubs">
        <thead><tr><th>Rank / partner hub</th><th>Revenue</th><th>Projected profit</th><th>Plan source</th><th>Action</th></tr></thead>
        <tbody>{hubs.map((hub, index) => <tr key={hub.store.id} className={selectedStoreId === hub.store.id ? 'current-hub' : undefined}>
          <td><strong>{index + 1}. {hub.store.name}</strong><small>{hub.store.city}{selectedStoreId === hub.store.id ? ' · In editor' : ''}</small></td>
          <td>{php(hub.revenue)}</td><td className={hub.profit < 0 ? 'negative' : ''}>{php(hub.profit)}</td>
          <td>{hub.hasDraft ? 'Saved draft' : 'No-promo baseline'}</td>
          <td><button aria-label={`Plan ${hub.store.name}`} onClick={() => onPlan(hub.store, category)}>Open plan</button></td>
        </tr>)}</tbody>
      </table></div>
    </> : <p>No partner hubs match this city.</p>}
    <p className="hint">Sorting helps you compare scale or investigate low-profit hubs; it does not predict incremental promotion
      returns or recommend launching a campaign. Opening a hub replaces unsaved editor changes. Scroll the chart or table when needed.</p>
  </section>;
}
