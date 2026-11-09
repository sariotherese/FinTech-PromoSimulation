//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createCategoryPlans, MODEL_VERSION, productCategories, simulateCategories, simulateCategory, type ScenarioSnapshot } from '@rayfin-app/shared';
import { createDemoCategoryPlans, stores } from './lib/demo-data';
import { listScenarios, saveScenario } from './lib/scenarios';
import homeCreditLogo from './assets/home-credit-logo.svg';

// The welcome view polls a dev-only activity endpoint via `useSourceActivity`.
// In this smoke test there is no dev server, so stub the hook to return no feed:
// the view renders its illustrative state synchronously and nothing settles after
// the test (which would otherwise log a React `act(...)` warning).
vi.mock('./lib/scenarios', () => ({
  listScenarios: vi.fn(async () => []),
  saveScenario: vi.fn(async () => {}),
  deleteScenario: vi.fn(async () => {}),
}));
vi.mock('./components/economics-chart', () => ({ EconomicsChart: () => <div>Economics chart</div> }));
vi.mock('./components/hub-chart', () => ({ HubChart: () => <div>Partner hub chart</div> }));

import App from '@/App';

describe('App', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(listScenarios).mockResolvedValue([]); });
  it('renders the portfolio with honest demo labelling and 17 city controls', async () => {
    render(<App />);
    expect(screen.getByRole('img', { name: 'Home Credit' })).toHaveAttribute('src', homeCreditLogo);
    expect(screen.getByRole('link', { name: 'Home Credit Philippines - portfolio overview' })).toBeVisible();
    expect(screen.getByText('SYNTHETIC DEMO DATA')).toBeVisible();
    expect(await screen.findByRole('group', { name: 'Metro Manila city heat map' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Makati: .*reference promotions/ })).toBeVisible();
    await waitFor(() => expect(listScenarios).toHaveBeenCalledOnce());
  });

  it('drills from a city into the matching store and editable promotion', async () => {
    render(<App />);
    await screen.findByRole('group', { name: 'Metro Manila city heat map' });
    fireEvent.click(screen.getByRole('button', { name: /Pasig: .*reference promotions/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pasig Digital Hub/ }));
    expect(screen.getByRole('combobox', { name: 'Choose partner store' })).toHaveValue(stores.find(s => s.name === 'Pasig Digital Hub')!.id);
    fireEvent.click(screen.getByRole('button', { name: '0% interest' }));
    expect(screen.getByLabelText('Annual flat interest')).toHaveValue(0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(saveScenario).toHaveBeenCalledWith(
      'Pasig growth plan',
      { version: MODEL_VERSION, store: stores.find(s => s.name === 'Pasig Digital Hub'),
        categoryPlans: createDemoCategoryPlans(stores.find(s => s.name === 'Pasig Digital Hub')!).map(plan =>
          plan.category === 'Electronics' ? { ...plan, assumptions: { ...plan.assumptions, annualInterest: 0, uplift: 25, marketing: 15000 } } : plan) },
      undefined,
    ));
    expect(await screen.findByText('Draft saved to Fabric. No promotion has been launched.')).toBeVisible();
  });
  it('shows all category revenue/profit and filters the portfolio and store planner consistently', async () => {
    render(<App />);
    const performance = await screen.findByRole('region', { name: 'Product category performance' });
    for (const category of productCategories) {
      expect(within(performance).getByRole('button', { name: new RegExp(category) })).toHaveTextContent('Projected profit');
    }
    fireEvent.change(screen.getByRole('combobox', { name: 'Portfolio category' }), { target: { value: 'Appliances' } });
    const expected = stores.reduce((sum, store) => sum + simulateCategories(store, createDemoCategoryPlans(store), true, 'Appliances').revenue, 0);
    const formatted = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 2 }).format(expected);
    expect(screen.getByText('Lender revenue', { selector: 'article > span' }).closest('article')).toHaveTextContent(formatted);
    fireEvent.click(screen.getByRole('button', { name: /Makati Digital Hub/ }));
    expect(screen.getByRole('button', { name: 'Plan Appliances' })).toHaveAttribute('aria-pressed', 'true');
    await screen.findByText('Economics chart');
  });
  it('increases appliance profit without changing other categories and saves all four plans', async () => {
    const store = stores.find(store => store.name === 'Makati Digital Hub')!;
    const appliances = createDemoCategoryPlans(store).find(plan => plan.category === 'Appliances')!;
    const profit = (loans: number) => new Intl.NumberFormat('en-PH', {
      style: 'currency', currency: 'PHP', maximumFractionDigits: 0,
    }).format(simulateCategory(store, { ...appliances, monthlyLoans: loans, ticket: 20000 }).profit);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Promotion studio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plan Appliances' }));
    const mobileBefore = screen.getByRole('button', { name: 'Plan Mobile phones' }).textContent;
    fireEvent.change(screen.getByLabelText('Baseline loans / month'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Average ticket (PHP)'), { target: { value: '20000' } });
    expect(screen.getByRole('region', { name: 'Simulation results' })).toHaveTextContent(profit(100));
    expect(screen.getByRole('button', { name: 'Plan Mobile phones' })).toHaveTextContent(mobileBefore!);
    fireEvent.change(screen.getByLabelText('Baseline loans / month'), { target: { value: '110' } });
    expect(screen.getByRole('region', { name: 'Simulation results' })).toHaveTextContent(profit(110));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(saveScenario).toHaveBeenCalled());
    const snapshot = vi.mocked(saveScenario).mock.calls[0][1];
    expect(snapshot.categoryPlans).toHaveLength(4);
    expect(snapshot.categoryPlans.find(plan => plan.category === 'Appliances')).toMatchObject({ monthlyLoans: 110, ticket: 20000 });
    await screen.findByText('Draft saved to Fabric. No promotion has been launched.');
  });
  it('scopes studio highlights to the planner and preserves keyboard city navigation', async () => {
    render(<App />);
    await screen.findByRole('group', { name: 'Metro Manila city heat map' });
    expect(screen.getByRole('main')).not.toHaveClass('promotion-studio');
    fireEvent.keyDown(screen.getByRole('button', { name: /Makati: .*reference promotions/ }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /Makati Digital Hub/ }));
    expect(screen.getByRole('main')).toHaveClass('promotion-studio');
    expect(screen.getByRole('navigation', { name: 'Main navigation' }).closest('.promotion-studio')).toBeNull();
    await screen.findByText('Economics chart');
    fireEvent.click(screen.getByRole('button', { name: 'Portfolio overview' }));
    expect(screen.getByRole('main')).not.toHaveClass('promotion-studio');
  });
  it('filters and ranks city hubs without changing the editor, then opens a category-specific hub plan', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Promotion studio' }));
    const priorities = await screen.findByRole('region', { name: 'Partner hub prioritization' });
    expect(within(priorities).getByRole('combobox', { name: 'Hub city filter' })).toHaveValue('Makati');
    const hubTable = within(priorities).getByRole('table', { name: 'Ranked partner hubs' });
    expect(within(hubTable).getAllByRole('row')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText('Baseline loans / month'), { target: { value: '123' } });
    fireEvent.change(within(priorities).getByRole('combobox', { name: 'Hub city filter' }), { target: { value: 'Pasig' } });
    expect(screen.getByLabelText('Baseline loans / month')).toHaveValue(123);
    expect(within(hubTable).queryByText(/Makati Digital Hub/)).not.toBeInTheDocument();
    expect(within(hubTable).getByText(/Pasig Digital Hub/)).toBeVisible();
    fireEvent.change(within(priorities).getByRole('combobox', { name: 'Hub category filter' }), { target: { value: 'Laptops' } });
    fireEvent.change(within(priorities).getByRole('combobox', { name: 'Hub ranking' }), { target: { value: 'revenue-desc' } });
    const expected = stores.filter(store => store.city === 'Pasig').map(store => ({
      store, ...simulateCategories(store, createDemoCategoryPlans(store), true, 'Laptops'),
    })).sort((a, b) => b.revenue - a.revenue);
    expect(within(hubTable).getAllByRole('row')[1]).toHaveTextContent(expected[0].store.name);
    fireEvent.click(within(priorities).getByRole('button', { name: 'Plan Pasig Digital Hub' }));
    expect(screen.getByRole('combobox', { name: 'Choose partner store' })).toHaveValue(stores.find(store => store.name === 'Pasig Digital Hub')!.id);
    expect(screen.getByRole('button', { name: 'Plan Laptops' })).toHaveAttribute('aria-pressed', 'true');
    await screen.findByText('Partner hub chart');
    await screen.findByText('Economics chart');
  });
  it('shows a service error without pretending drafts loaded successfully', async () => {
    vi.mocked(listScenarios).mockRejectedValue(new Error('Permission denied'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved drafts. Permission denied');
    fireEvent.click(screen.getByRole('button', { name: /Create a promotion/ }));
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await screen.findByText('Economics chart');
  });
  it('blocks invalid financial input rather than showing a plausible result', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Promotion studio' }));
    fireEvent.change(screen.getByLabelText('Customer discount'), { target: { value: '101' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Customer discount must be between 0 and 80.');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await waitFor(() => expect(listScenarios).toHaveBeenCalledOnce());
  });
  it('lets finance edit store volume and ticket without accepting invalid values', async () => {
    const store = stores.find(store => store.name === 'Makati Digital Hub')!;
    const electronics = createDemoCategoryPlans(store).find(plan => plan.category === 'Electronics')!;
    const expected = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })
      .format(simulateCategory(store, { ...electronics, monthlyLoans: 100, ticket: 20000 }).profit);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Promotion studio' }));
    fireEvent.change(screen.getByLabelText('Baseline loans / month'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Average ticket (PHP)'), { target: { value: '20000' } });
    await screen.findByText('Economics chart');
    expect(screen.getByRole('region', { name: 'Simulation results' })).toHaveTextContent(expected);
    fireEvent.change(screen.getByLabelText('Average ticket (PHP)'), { target: { value: '' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Average ticket must be greater than zero.');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });
  it('retains a saved snapshot rather than regenerating its category inputs from new demo profiles', async () => {
    const store = { ...stores[0], monthlyLoans: 100, ticket: 20000 };
    const data: ScenarioSnapshot = { version: MODEL_VERSION, store, categoryPlans: createCategoryPlans(store) };
    vi.mocked(listScenarios).mockResolvedValue([{
      id: 'existing-draft', title: 'Existing plan', storeId: store.id, snapshot: JSON.stringify(data),
      createdAt: new Date(0), updatedAt: new Date(0), owner_id: 'test-owner', data,
    }]);
    render(<App />);
    await screen.findByRole('group', { name: 'Metro Manila city heat map' });
    fireEvent.click(screen.getByRole('button', { name: 'Promotion studio' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Hub city filter' }), { target: { value: store.city } });
    fireEvent.click(screen.getByRole('button', { name: `Plan ${store.name}` }));
    expect(screen.getByLabelText('Baseline loans / month')).toHaveValue(25);
    expect(screen.getByLabelText('Average ticket (PHP)')).toHaveValue(20000);
    expect(screen.getByLabelText('Loan term')).toHaveValue(6);
    expect(screen.getByRole('region', { name: 'Simulation results' })).toHaveTextContent('₱68,250');
    expect(screen.getByRole('button', { name: 'Update draft' })).toBeEnabled();
    expect(saveScenario).not.toHaveBeenCalled();
    await screen.findByText('Economics chart');
  });
});
