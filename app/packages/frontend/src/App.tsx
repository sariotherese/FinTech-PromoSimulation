//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { lazy, Suspense, useContext, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, Building2, Calculator, ChevronRight, CircleHelp,
  Download, FlaskConical, LayoutDashboard, MapPin, Moon, Plus, Save, Sun, Trash2,
} from 'lucide-react';
import {
  assumptionFields, defaultAssumptions, isProductCategory, MODEL_VERSION, productCategories,
  simulateCategories, simulateCategory, validateCategoryPlans,
  type Assumptions, type CategoryPlan, type ProductCategory, type Store,
} from '@rayfin-app/shared';
import { ThemeContext } from './hooks/theme.context';
import { cities, createDemoCategoryPlans, stores } from './lib/demo-data';
import { deleteScenario, listScenarios, saveScenario, type SavedScenario } from './lib/scenarios';
import { MetroMap, type CitySummary } from './components/metro-map';
import { HubPriorities } from './components/hub-priorities';
import homeCreditLogo from './assets/home-credit-logo.svg';
const EconomicsChart = lazy(() => import('./components/economics-chart').then(module => ({ default: module.EconomicsChart })));

type View = 'overview' | 'planner' | 'scenarios' | 'methodology';
const php = (n: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 0,
}).format(n);
const compact = (n: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 2,
}).format(n);
const message = (error: unknown) => error instanceof Error ? error.message : 'Unexpected operation failure.';

function Metric({ label, value, note, negative = false }: {
  label: string; value: string; note: string; negative?: boolean;
}) {
  return <article className="metric"><span>{label}</span>
    <strong className={negative ? 'negative' : ''}>{value}</strong><small>{note}</small></article>;
}

function App() {
  const [view, setView] = useState<View>('overview');
  const [city, setCity] = useState('Makati');
  const [store, setStore] = useState<Store>(stores.find(s => s.city === 'Makati')!);
  const [plans, setPlans] = useState(() => createDemoCategoryPlans(store));
  const [category, setCategory] = useState<ProductCategory>('Electronics');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory>();
  const activePlan = plans.find(plan => plan.category === category)!;
  const a = activePlan.assumptions;
  const [title, setTitle] = useState('Makati growth plan');
  const [editing, setEditing] = useState<string>();
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [metric, setMetric] = useState<'revenue' | 'profit' | 'promotions'>('revenue');
  const [search, setSearch] = useState('');
  const [comparison, setComparison] = useState<string[]>([]);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    let cancelled = false;
    listScenarios().then(drafts => {
      if (!cancelled) setSaved(drafts);
    }).catch(err => {
      if (!cancelled) setError(`Could not load saved drafts. ${message(err)}`);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadVersion]);

  const latest = useMemo(() => {
    const map = new Map<string, SavedScenario>();
    for (const draft of saved) if (!map.has(draft.storeId)) map.set(draft.storeId, draft);
    return map;
  }, [saved]);
  const portfolio = useMemo(() => stores.map(current => {
    const draft = latest.get(current.id);
    return { store: draft?.data.store ?? current, plans: draft?.data.categoryPlans ?? createDemoCategoryPlans(current), hasDraft: Boolean(draft) };
  }), [latest]);
  const categoryTotals = productCategories.map(productCategory => portfolio.reduce((total, entry) => {
    const result = simulateCategories(entry.store, entry.plans, true, productCategory);
    return { revenue: total.revenue + result.revenue, profit: total.profit + result.profit };
  }, { revenue: 0, profit: 0 }));
  const summaries = useMemo<CitySummary[]>(() => cities.map(c => {
    const values = stores.filter(s => s.city === c.name);
    return values.reduce<CitySummary>((total, current) => {
      const draft = latest.get(current.id);
      const result = simulateCategories(draft?.data.store ?? current,
        draft?.data.categoryPlans ?? createDemoCategoryPlans(current), true, categoryFilter);
      total.revenue += result.revenue;
      total.profit += result.profit;
      total.spend += result.promoSpend;
      total.promotions += Number(current.currentPromo !== 'No campaign');
      total.drafts += Number(Boolean(draft));
      return total;
    }, { name: c.name, revenue: 0, profit: 0, spend: 0, promotions: 0, drafts: 0 });
  }), [latest, categoryFilter]);
  const totals = summaries.reduce((t, c) => ({
    revenue: t.revenue + c.revenue, profit: t.profit + c.profit,
    spend: t.spend + c.spend, drafts: t.drafts + c.drafts,
  }), { revenue: 0, profit: 0, spend: 0, drafts: 0 });
  const selectedCity = summaries.find(c => c.name === city)!;
  const errors = validateCategoryPlans(store, plans);
  const proposed = errors.length ? null : simulateCategory(store, activePlan);
  const baseline = errors.length ? null : simulateCategory(store, activePlan, true);
  const storeTotal = errors.length ? null : simulateCategories(store, plans);
  const cityStores = stores.filter(s => s.city === city &&
    `${s.name} ${productCategories.join(' ')}`.toLowerCase().includes(search.toLowerCase()));

  function openStore(next: Store) {
    setStore(next);
    setCity(next.city);
    setPlans(createDemoCategoryPlans(next));
    setCategory(categoryFilter ?? (isProductCategory(next.category) ? next.category : 'Electronics'));
    setTitle(`${next.city} growth plan`);
    setEditing(undefined);
    setNotice('');
    setView('planner');
  }
  function openDraft(draft: SavedScenario) {
    setStore(draft.data.store); setCity(draft.data.store.city);
    setPlans(draft.data.categoryPlans);
    setCategory(categoryFilter ?? (isProductCategory(draft.data.store.category) ? draft.data.store.category : 'Electronics'));
    setTitle(draft.title);
    setEditing(draft.id); setNotice(''); setView('planner');
  }
  function setA(next: Assumptions | ((current: Assumptions) => Assumptions)) {
    setPlans(current => current.map(plan => plan.category === category
      ? { ...plan, assumptions: typeof next === 'function' ? next(plan.assumptions) : next } : plan));
  }
  function updatePlan(patch: Partial<Pick<CategoryPlan, 'monthlyLoans' | 'ticket'>>) {
    setPlans(current => current.map(plan => plan.category === category ? { ...plan, ...patch } : plan));
  }
  function preset(type: 'discount' | 'zero' | 'combo' | 'reset') {
    setA(current => ({
      ...current, discount: type === 'discount' || type === 'combo' ? 10 : 0,
      annualInterest: type === 'zero' || type === 'combo' ? 0 : defaultAssumptions.annualInterest,
      uplift: type === 'reset' ? 0 : type === 'combo' ? 40 : 25,
      marketing: type === 'reset' ? 0 : 15000,
    }));
    setNotice('');
  }
  async function persist(asNew: boolean) {
    setBusy(true); setError(''); setNotice('');
    try {
      await saveScenario(title, { version: MODEL_VERSION, store, categoryPlans: plans }, asNew ? undefined : editing);
      setSaved(await listScenarios());
      setNotice(asNew || !editing ? 'Draft saved to Fabric. No promotion has been launched.' : 'Draft updated in Fabric.');
      setEditing(undefined);
      setView('scenarios');
    } catch (err) { setError(`Could not confirm the save. Reload drafts before retrying. ${message(err)}`); }
    finally { setBusy(false); }
  }
  async function remove(draft: SavedScenario) {
    if (!window.confirm(`Delete "${draft.title}"? This cannot be undone.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await deleteScenario(draft.id);
      setSaved(await listScenarios());
      setComparison(ids => ids.filter(id => id !== draft.id));
      setNotice('Draft deleted from Fabric.');
    } catch (err) { setError(`Could not confirm deletion. Reload drafts to check its status. ${message(err)}`); }
    finally { setBusy(false); }
  }
  function exportComparison() {
    const drafts = saved.filter(d => comparison.includes(d.id));
    const rows = [
      ['Scenario', 'Store', 'City', 'Category', 'Days', 'Loan term months', 'Discount %', 'Annual flat interest %',
        'Baseline loans per month', 'Average ticket PHP', 'Loans', 'Revenue PHP', 'Promo spend PHP', 'Budget PHP', 'Profit PHP', 'Loss PHP', 'Model'],
      ...drafts.flatMap(d => d.data.categoryPlans.map(plan => {
        const r = simulateCategory(d.data.store, plan);
        return [d.title, d.data.store.name, d.data.store.city, plan.category, plan.assumptions.days,
          plan.assumptions.term, plan.assumptions.discount, plan.assumptions.annualInterest,
          plan.monthlyLoans, plan.ticket, r.loans, r.revenue, r.promoSpend, plan.assumptions.budget, r.profit, r.loss, d.data.version];
      })),
    ];
    const quote = (value: string | number) => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const blob = new Blob(['\uFEFF', rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'hc-draft-comparison.csv'; link.click();
    URL.revokeObjectURL(link.href);
  }
  const nav = [
    { id: 'overview' as const, label: 'Portfolio overview', icon: LayoutDashboard },
    { id: 'planner' as const, label: 'Promotion studio', icon: Calculator },
    { id: 'scenarios' as const, label: 'Saved scenarios', icon: FlaskConical },
    { id: 'methodology' as const, label: 'Model & assumptions', icon: CircleHelp },
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="Home Credit Philippines - portfolio overview"
        onClick={event => { event.preventDefault(); setView('overview'); }}>
        <span className="brand-logo"><img src={homeCreditLogo} alt="Home Credit" width={118} height={49} /></span>
        <span className="brand-caption">PHILIPPINES · FINANCE LAB</span>
      </a>
      <div className="workspace-label">PARTNER GROWTH WORKSPACE</div>
      <nav aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) =>
        <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => setView(id)}>
          <Icon size={18} />{label}{id === 'scenarios' && <span className="nav-count">{saved.length}</span>}
        </button>)}</nav>
      <div className="sidebar-foot"><span className="pill"><span className="status-dot" /> Fabric app</span>
        <p>Better promotions.<br />Clearer decisions.</p><small>Planning sandbox · model v{MODEL_VERSION}</small></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span>Finance <ChevronRight size={14} /> Promotion simulator</span>
        <div className="toolbar"><span className="demo-badge">SYNTHETIC DEMO DATA</span>
          <button className="icon-button" aria-label="Toggle color theme" onClick={theme.toggleTheme}>
            {theme.isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <span className="avatar" aria-label="Finance account team">FA</span></div>
      </header>
      <main className={view === 'planner' ? 'promotion-studio' : undefined}>
        <div className="page-heading"><div><div className="eyebrow">HOME CREDIT PHILIPPINES</div>
          <h1>{view === 'overview' ? 'A smarter plan for every partner.' : view === 'planner' ? 'Turn a promotion into a plan.'
            : view === 'scenarios' ? 'Compare before you commit.' : 'Know what is behind the numbers.'}</h1>
          <p>{view === 'overview' ? 'Explore Metro Manila. Find your next opportunity. Model the impact.'
            : view === 'planner' ? 'Adjust the levers and see the economics change in real time.'
            : view === 'scenarios' ? 'Your private, saved drafts. Nothing here launches a real campaign.'
            : 'Transparent demo assumptions, not an approved credit-pricing or forecasting model.'}</p></div>
          {view === 'overview' && <button className="primary" onClick={() => openStore(stores.find(s => s.city === city)!)}>
            <Plus size={17} /> Create a promotion</button>}
        </div>
        {error && <div role="alert" className="alert error"><strong>Action needed</strong><span>{error}</span>
          <button onClick={() => { setLoading(true); setError(''); setLoadVersion(v => v + 1); }} disabled={loading || busy}>Retry loading drafts</button></div>}
        {notice && <div role="status" className="alert success">{notice}</div>}
        {loading && <div role="status" className="alert">Connecting to your saved drafts in Fabric…</div>}

        {view === 'overview' && !loading && !error && <>
          <div className="section-caption"><span className="status-dot" /> Draft portfolio · 30-day origination cohort
            <span>Lifetime economics · latest saved draft per store; baseline elsewhere</span></div>
          <section className="panel category-overview" aria-label="Product category performance">
            <div className="panel-heading"><div><h2>Installments by product category</h2>
              <p>Metro Manila portfolio · revenue and projected profit by category</p></div>
              <label className="field">Portfolio category<select aria-label="Portfolio category" value={categoryFilter ?? ''}
                onChange={event => {
                  const value = event.target.value;
                  if (value === '' || isProductCategory(value)) setCategoryFilter(value || undefined);
                }}><option value="">All categories</option>{productCategories.map(value => <option key={value}>{value}</option>)}</select></label>
            </div>
            <div className="category-cards">{productCategories.map((value, index) =>
              <button key={value} className={`category-card ${categoryFilter === value ? 'active' : ''}`}
                aria-pressed={categoryFilter === value} onClick={() => setCategoryFilter(categoryFilter === value ? undefined : value)}>
                <strong>{value}</strong><span>Revenue <b>{php(categoryTotals[index].revenue)}</b></span>
                <span>Projected profit <b className={categoryTotals[index].profit < 0 ? 'negative' : ''}>{php(categoryTotals[index].profit)}</b></span>
              </button>)}</div>
            <p className="hint">{categoryFilter ?? 'All categories'} selected. Portfolio totals, city map and partner-store figures below follow this filter.</p>
          </section>
          <div className="metrics">
            <Metric label="Lender revenue" value={compact(totals.revenue)} note="Interest + fees + partner subsidy" />
            <Metric label="Projected net profit" value={compact(totals.profit)} negative={totals.profit < 0} note="After funding, credit loss & expenses" />
            <Metric label="Promotion spend" value={compact(totals.spend)} note="HC-funded discounts + campaign spend" />
            <Metric label="Stores with saved plans" value={`${totals.drafts} / ${stores.length}`} note={`${categoryFilter ?? 'All categories'} · 17 LGUs`} />
          </div>
          <div className="overview-grid">
            <section className="panel map-panel">
              <div className="panel-heading"><div><h2>Metro Manila opportunity map</h2><p>Select a city to explore its partner stores</p></div>
                <select aria-label="Map metric" value={metric} onChange={event => {
                  const value = event.target.value;
                  if (value === 'revenue' || value === 'profit' || value === 'promotions') setMetric(value);
                }}><option value="revenue">Lender revenue</option><option value="profit">Net profit</option>
                  <option value="promotions">Reference promotions</option></select></div>
              <MetroMap summaries={summaries} selected={city} metric={metric} onSelect={name => { setCity(name); setSearch(''); }} />
              <div className="map-legend"><span>Lower</span><span className="legend-ramp" /><span>Higher {metric}</span>
                <small>Negative profit shown in red</small></div>
              <small className="map-credit">High-resolution boundaries: Philippines JSON Maps (MIT). Not for legal use.</small>
            </section>
            <section className="panel city-panel">
              <div className="panel-heading"><div><div className="eyebrow">CITY SPOTLIGHT</div><h2><MapPin size={20} /> {city}</h2></div>
                <span className="pill">3 partner stores</span></div>
              <div className="city-stats"><div><small>Lender revenue</small><strong>{compact(selectedCity.revenue)}</strong></div>
                <div><small>Projected profit</small><strong className={selectedCity.profit < 0 ? 'negative' : ''}>{compact(selectedCity.profit)}</strong></div></div>
              <div className="city-promo">{selectedCity.promotions} reference promo tags <span>·</span> {selectedCity.drafts} saved store plans</div>
              <input aria-label="Search stores" placeholder="Search partner stores…" value={search} onChange={event => setSearch(event.target.value)} />
              <div className="store-list">{cityStores.map(current => {
                const draft = latest.get(current.id);
                const result = simulateCategories(draft?.data.store ?? current,
                  draft?.data.categoryPlans ?? createDemoCategoryPlans(current), true, categoryFilter);
                return <button className="store-card" key={current.id} onClick={() => draft ? openDraft(draft) : openStore(current)}>
                  <span className="store-icon"><Building2 size={21} /></span><span><strong>{current.name}</strong>
                    <small>{categoryFilter ?? 'All 4 product categories'} · {Math.round(result.loans)} projected loans / 30 days</small>
                    <small>Revenue {compact(result.revenue)}{' · '}Profit {compact(result.profit)}</small>
                    <span className={draft ? 'store-tag planned' : 'store-tag'}>{draft ? 'Saved draft' : current.currentPromo}</span>
                  </span><ChevronRight size={18} /></button>;
              })}{!cityStores.length && <p>No stores match your search.</p>}</div>
              <p className="hint">Store names and financials are fictional. Reference promo tags are illustrative, not live campaigns.</p>
            </section>
          </div>
          <section className="panel city-directory"><div className="panel-heading"><div><h2>Across the metro</h2>
            <p>All 16 cities and the municipality of Pateros</p></div><span className="pill">17 LGUs</span></div>
            <div className="city-chips">{summaries.map(c => <button key={c.name} className={c.name === city ? 'city-chip active' : 'city-chip'}
              onClick={() => { setCity(c.name); setSearch(''); }}>{c.name}<strong>{compact(c.revenue)}</strong></button>)}</div>
          </section>
        </>}

        {view === 'planner' && <>
          {!loading && !error && <HubPriorities entries={portfolio} initialCity={city} selectedStoreId={store.id}
            onPlan={(current, productCategory) => {
              const draft = latest.get(current.id);
              if (draft) openDraft(draft); else openStore(current);
              if (productCategory) setCategory(productCategory);
            }} />}
          <div className="planner-context"><div><MapPin size={16} /><select aria-label="Choose partner store" value={store.id}
            onChange={event => { const next = stores.find(s => s.id === event.target.value); if (next) openStore(next); }}>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <span>4 product categories · separate installment and promotion plans</span></div>
          <section className="panel category-planning" aria-label="Store category plans">
            <div className="panel-heading"><div><h2>Plan your product mix</h2>
              <p>Select a category, then increase its loan volume or adjust its promotion below.</p></div></div>
            <div className="category-cards">{plans.map(plan => {
              const result = errors.length ? null : simulateCategory(store, plan);
              return <button key={plan.category} className={`category-card ${category === plan.category ? 'active' : ''}`}
                aria-label={`Plan ${plan.category}`} aria-pressed={category === plan.category}
                onClick={() => { setCategory(plan.category); setNotice(''); }}>
                <strong>{plan.category}</strong><span>{Number.isFinite(plan.monthlyLoans) ? plan.monthlyLoans : 'Invalid'} baseline loans / month</span>
                <span>Revenue <b>{result ? php(result.revenue) : 'Fix inputs'}</b></span>
                <span>Projected profit <b className={result && result.profit < 0 ? 'negative' : ''}>{result ? php(result.profit) : 'Fix inputs'}</b></span>
              </button>;
            })}</div>
            {storeTotal && <div className="store-category-total" aria-label="Combined store results">
              <strong>All categories combined</strong><span>Revenue {php(storeTotal.revenue)}</span>
              <span>Projected profit {php(storeTotal.profit)}</span><span>Promotion spend {php(storeTotal.promoSpend)}</span>
              <span>Budget cap {php(storeTotal.budget)}</span>
            </div>}
            <p className="hint">Synthetic product mixes, ticket sizes, installment terms, costs and risk vary by category and hub.
              These are illustrative retail profiles, not Home Credit pricing or observed city demographics.
              Saved drafts retain their original inputs. Fixed spend and budgets belong to each category.</p>
          </section>
          <div className="planner-grid">
            <section className="panel assumptions">
              <div className="panel-heading"><div><h2>Build your {category.toLowerCase()} promotion</h2><p>Editing {category} only · other categories are unchanged</p></div><Calculator size={20} /></div>
              <label className="field full">Scenario name<input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} /></label>
              <div className="preset-label">START WITH A PROMOTION</div>
              <div className="presets"><button onClick={() => preset('discount')}>10% discount</button>
                <button onClick={() => preset('zero')}>0% interest</button><button onClick={() => preset('combo')}>Combo offer</button>
                <button onClick={() => preset('reset')}>Reset</button></div>
              <div className="fields store-inputs">
                <label className="field">Baseline loans / month<input type="number" min={0} step={1}
                  value={Number.isFinite(activePlan.monthlyLoans) ? activePlan.monthlyLoans : ''}
                  onChange={event => updatePlan({ monthlyLoans: event.target.valueAsNumber })} /></label>
                <label className="field">Average ticket (PHP)<input type="number" min={1} step={100}
                  value={Number.isFinite(activePlan.ticket) ? activePlan.ticket : ''}
                  onChange={event => updatePlan({ ticket: event.target.valueAsNumber })} /></label>
              </div>
              <div className="fields">{assumptionFields.slice(0, 6).map(field => <label className="field" key={field.key}>
                {field.label}<div className="input-unit"><input aria-label={field.label} type="number" min={field.min} max={field.max} step={field.step}
                  value={Number.isFinite(a[field.key]) ? a[field.key] : ''}
                  onChange={event => setA({ ...a, [field.key]: event.target.valueAsNumber })} /><span>{field.unit}</span></div>
              </label>)}</div>
              <details className="advanced"><summary>Funding, risk & budget assumptions</summary><div className="fields">
                {assumptionFields.slice(6).map(field => <label className="field" key={field.key}>{field.label}
                  <div className="input-unit"><input aria-label={field.label} type="number" min={field.min} max={field.max} step={field.step}
                    value={Number.isFinite(a[field.key]) ? a[field.key] : ''}
                    onChange={event => setA({ ...a, [field.key]: event.target.valueAsNumber })} /><span>{field.unit}</span></div></label>)}
              </div></details>
              <p className="hint">Uplift is an assumption you choose, not a prediction. 0% interest does not imply zero fees. All loans are assumed fully financed.</p>
              {errors.length > 0 && <div role="alert" className="alert error">{errors.join(' ')}</div>}
              <div className="actions"><button className="primary" disabled={busy || loading || Boolean(error) || !proposed || !title.trim()}
                onClick={() => void persist(false)}><Save size={16} />{busy ? 'Saving…' : editing ? 'Update draft' : 'Save draft'}</button>
                {editing && <button disabled={busy || loading || Boolean(error) || !proposed || !title.trim()} onClick={() => void persist(true)}>Save as new</button>}</div>
            </section>
            <section className="panel results" aria-label="Simulation results" aria-live="polite">
              <div className="panel-heading"><div><div className="eyebrow">ESTIMATED IMPACT · {category.toUpperCase()}</div><h2>Your promotion, in numbers</h2></div><span className="pill">Draft only</span></div>
              {proposed && baseline ? <>
                <div className={`profit-hero ${proposed.profit < 0 ? 'loss' : ''}`}><span>Projected net {proposed.profit < 0 ? 'loss' : 'profit'}</span>
                  <strong>{php(Math.abs(proposed.profit))}</strong><div>
                    {proposed.profit >= baseline.profit ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    {php(proposed.profit - baseline.profit)} vs no-promo baseline</div></div>
                <div className="result-mini"><div><small>Lender revenue</small><strong>{php(proposed.revenue)}</strong></div>
                  <div><small>Promotion spend</small><strong>{php(proposed.promoSpend)}</strong></div>
                  <div><small>Projected loans</small><strong>{proposed.loans.toLocaleString()}</strong></div>
                  <div><small>Profit margin</small><strong>{proposed.margin === null ? 'N/A' : `${proposed.margin.toFixed(1)}%`}</strong></div></div>
                <div className={proposed.budgetRemaining < 0 ? 'budget-warning' : 'budget-ok'}>
                  {proposed.budgetRemaining < 0 ? 'Over promotion budget by ' : 'Promotion budget remaining: '}{php(Math.abs(proposed.budgetRemaining))}</div>
                <Suspense fallback={<p role="status">Loading economics chart…</p>}>
                  <EconomicsChart baseline={baseline} proposed={proposed} />
                </Suspense>
                <div className="breakdown">{[
                  ['Financed principal (not revenue)', proposed.principal],
                  ['Interest income', proposed.interest], ['Customer fees', proposed.fees],
                  ['Partner subsidy income', proposed.subsidy], ['Funding cost', -proposed.funding],
                  ['Expected credit loss', -proposed.creditLoss], ['Operating cost', -proposed.operating],
                  ['HC-funded discount', -proposed.discountCost], ['Fixed campaign spend', -a.marketing],
                ].map(([label, amount]) => <div key={label}><span>{label}</span><strong>{php(Number(amount))}</strong></div>)}</div>
                <p className="hint">Break-even: {proposed.breakEvenLoans === null ? 'unreachable at this per-loan contribution' : `${proposed.breakEvenLoans} loans to cover fixed campaign spend`}.
                  {' '}Campaign: {a.days} days; income and costs cover the full {a.term}-month loan cohort, not just the campaign month.</p>
              </> : <p className="hint">Enter valid assumptions to calculate the simulation.</p>}
            </section>
          </div>
        </>}

        {view === 'scenarios' && <section className="panel">
          <div className="panel-heading"><div><h2>Saved draft scenarios</h2><p>Select drafts for side-by-side comparison. Records are private to your signed-in account.</p></div>
            <button disabled={!comparison.length} onClick={exportComparison}><Download size={16} /> Export comparison</button></div>
          {!loading && !saved.length && !error && <div className="empty"><FlaskConical size={36} /><h3>Your next great promotion starts here.</h3>
            <p>Create a store plan and save it to compare the economics.</p><button className="primary" onClick={() => openStore(store)}>Open promotion studio</button></div>}
          {saved.length > 0 && <div className="table-scroll"><table><thead><tr><th>Compare</th><th>Scenario / store</th><th>Duration</th><th>Revenue</th><th>Promo spend</th><th>Net profit / loss</th><th>Actions</th></tr></thead>
            <tbody>{saved.map(draft => {
              const result = simulateCategories(draft.data.store, draft.data.categoryPlans);
              return <tr key={draft.id}><td><input type="checkbox" aria-label={`Compare ${draft.title}`} checked={comparison.includes(draft.id)}
                onChange={event => setComparison(ids => event.target.checked ? [...ids, draft.id] : ids.filter(id => id !== draft.id))} /></td>
                <td><strong>{draft.title}</strong><small>{draft.data.store.name}</small><small>Appliances · Mobile phones · Laptops · Electronics</small></td>
                <td>{[...new Set(draft.data.categoryPlans.map(plan => plan.assumptions.days))].join(' / ')} days by category</td>
                <td>{php(result.revenue)}</td><td>{php(result.promoSpend)}</td><td className={result.profit < 0 ? 'negative' : 'positive'}>{php(result.profit)}</td>
                <td><div className="actions"><button disabled={busy} onClick={() => openDraft(draft)}>Edit</button>
                  <button className="icon-button" disabled={busy} aria-label={`Delete ${draft.title}`} onClick={() => void remove(draft)}><Trash2 size={16} /></button></div></td></tr>;
            })}</tbody></table></div>}
          {comparison.length > 0 && <div className="comparison"><h3>Side-by-side economics</h3>
            <p className="hint">Amounts cover each draft's campaign cohort and full loan term. Different stores, durations and assumptions are not like-for-like.</p>
            <div className="comparison-grid">{saved.filter(d => comparison.includes(d.id)).map(draft => {
              const r = simulateCategories(draft.data.store, draft.data.categoryPlans);
              return <article className="comparison-card" key={draft.id}><span className="pill">Draft · v{draft.data.version}</span>
                <h3>{draft.title}</h3><p>{draft.data.store.name}</p><dl>
                  {[['Revenue', php(r.revenue)],
                    ['Promotion spend', php(r.promoSpend)], ['Budget cap', php(r.budget)],
                    ['Net profit', php(r.profit)], ['Loss', php(r.loss)]].map(([label, value]) =>
                    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                </dl>{draft.data.categoryPlans.map(plan => {
                  const result = simulateCategory(draft.data.store, plan);
                  return <div className="comparison-category" key={plan.category}><strong>{plan.category}</strong>
                    <p>{plan.monthlyLoans} baseline loans / month · ticket {php(plan.ticket)}<br />
                      {plan.assumptions.days} days · {plan.assumptions.term} months · {plan.assumptions.discount}% discount
                      {' · '}{plan.assumptions.annualInterest}% annual flat interest · {plan.assumptions.uplift}% uplift</p>
                    <p>Revenue {php(result.revenue)} · Profit {php(result.profit)} · Promotion spend {php(result.promoSpend)}</p>
                  </div>;
                })}</article>;
            })}</div></div>}
        </section>}

        {view === 'methodology' && <section className="panel methodology">
          <h2>Planning, not a promise.</h2><p>This demo is designed for finance account teams to explore partner-store promotions.
            It is not affiliated with or approved by Home Credit Philippines. No customer data, actual store records or live financial data is used.</p>
          <h3>What is included</h3><ul><li>51 fictional partner stores across 16 Metro Manila cities and Pateros.</li>
            <li>Appliances, mobile phones, laptops and electronics at every partner store, each with its own volume, ticket and promotion assumptions.</li>
            <li>Discount, zero-interest and combined offers; editable volume, funding, risk, budget and fee assumptions.</li>
            <li>Private saved drafts in the Fabric app's managed SQL data service. No real promotion activation.</li></ul>
          <h3>Model v{MODEL_VERSION} · PHP nominal lifetime economics</h3>
          <dl className="formula-list">
            <div><dt>Loan volume</dt><dd>round(monthly baseline loans × campaign days / 30 × (1 + assumed uplift))</dd></div>
            <div><dt>Financed principal</dt><dd>loan volume × average ticket × (1 − discount rate). Assumes full financing and no down payment.</dd></div>
            <div><dt>Lender revenue</dt><dd>principal × (annual flat interest × term / 12 + customer fee + partner subsidy)</dd></div>
            <div><dt>Funding cost</dt><dd>principal × 50% average outstanding balance × annual funding rate × term / 12</dd></div>
            <div><dt>Expected credit loss</dt><dd>principal × lifetime probability of default × loss given default</dd></div>
            <div><dt>Promotion spend</dt><dd>undiscounted ticket sales × discount rate × HC funding share + fixed campaign spend</dd></div>
            <div><dt>Net profit</dt><dd>lender revenue − funding cost − expected credit loss − operating cost − promotion spend</dd></div>
            <div><dt>Loss / budget</dt><dd>loss = max(0, −net profit). Budget remaining = promotion budget cap − promotion spend.</dd></div>
            <div><dt>No-promo baseline</dt><dd>Same store, duration, term and risk/cost assumptions; 30% annual flat interest, no discount, no uplift and no campaign spend.</dd></div>
            <div><dt>Category roll-up</dt><dd>Store totals sum the four independent category plans, charging each category's fixed spend only once.
              New demo plans use repeatable, varied retail profiles: appliance-led Home Living hubs, phone-led Mobile Corners
              and mixed Digital Hubs, with different category tickets, terms, costs, risk and budgets.
              Older v1.0 drafts retain all volume and spend in their original category, preserving their financial totals.</dd></div>
            <div><dt>Overview roll-up</dt><dd>Latest saved draft per store, baseline elsewhere. Each category cohort is normalized independently to 30 campaign days.
              All income and costs remain lifetime estimates, not monthly accounting revenue.</dd></div>
          </dl>
          <h3>Important limitations</h3><p>Flat interest is not APR. This model does not calculate amortization, NPV, tax,
            VAT, prepayments, delinquency timing, interest non-accrual, regulatory disclosures or cannibalization.
            Expected losses are deducted separately from contractual revenue. Partner subsidies are assumed collectible.
            Reference campaign tags are illustrative metadata and do not alter baseline economics.
            Promotion uplift must be validated with experiments and approved finance assumptions before business use.</p>
          <p>Saved snapshots retain store inputs and model version for reproducibility. Edits to a draft update its snapshot;
            use “Save as new” to retain alternatives. This is not a formal audit or approval system.</p>
        </section>}
        <footer>HOME CREDIT PHILIPPINES · PROMOTION SIMULATOR <span>Synthetic data. Illustrative estimates. Drafts only.</span></footer>
      </main>
    </div>
  </div>;
}

export default App;
