# Home Credit PH Promotion Simulator

A Microsoft Fabric / Rayfin planning sandbox for finance account teams. Uses
**synthetic demo data**, not actual Home Credit records or an approved pricing model.

## Features

- Portfolio overview and geographic heat map covering all 17 Metro Manila LGUs.
- City-to-store drill-down across 51 fictional partner stores.
- Category-level revenue and projected profit for **appliances, mobile phones,
  laptops and electronics**, with a category filter applied to portfolio KPIs,
  the city map and partner-store figures.
- Four independent category plans per partner store: edit category loan volume,
  average ticket, installment term, discounts, zero-interest offers and costs;
  see both selected-category economics and combined store totals.
- Promotion Studio partner-hub bar chart and accessible ranked table: filter
  by city or product category, compare revenue and projected profit, sort by
  highest revenue or highest/lowest profit, and open a hub's saved or new plan.
- Discount, zero-interest and combination scenarios with editable loan volume,
  average ticket, term, risk, funding, partner subsidy, promotion budget and operating costs.
- Live lifetime revenue, profit/loss, promotion spend and budget-overrun estimates.
- Private saved scenarios in Rayfin's managed SQL data service, with edit,
  delete, side-by-side comparison and CSV export.
- Protected Fabric hosting, Microsoft sign-in and server-side owner-scoped records.

Nothing in this app activates real promotions. All uplift figures are assumptions,
not predictions. Financial formulas and limitations are explained on the
**Model & assumptions** page and implemented in
[`simulation.ts`](app/packages/shared/src/simulation.ts).

## Visual identity

The interface references [Home Credit Philippines](https://www.homecredit.ph/):
red (`#e11931`), white and neutral surfaces, bold headings and rounded primary
actions. The official SVG logo is bundled locally without modification for
reliable display in Fabric, including the responsive sidebar and app sign-in
screen. Dark mode uses accessible lighter-red accents and a white logo backing.
Promotion Studio uses page-scoped light-blue highlights for presets, results,
focus states and its economics chart, with a matching dark-mode treatment.
The surrounding Home Credit navigation, header and logo retain their red branding.
Brand assets remain the property of their owners; this is an unofficial demo.
See [third-party notices](app/THIRD-PARTY-NOTICES.txt) for the logo source.

## Development

Use Node.js **24 LTS** (Rayfin also supports 20 and 22; the installed CLI does not
declare support for Node 26). From PowerShell:

```powershell
Set-Location app
npm ci
npx rayfin login
npm run dev
```

The backend runs in Fabric, not in a local SQL emulator. The target tenant must
enable Fabric Apps, and the workspace must have compatible capacity and access.

## Checks

Run serially from `app`:

```powershell
npm run typecheck
npm run build
npm run lint
npm test
npm run validate:visual
```

After deployment, verify sign-in, map/store drill-down, zero-interest and discount
results, saved draft create/reload/edit/delete, comparison and mobile layout.

## Deployment

Confirmed workspace: `6d6350e8-6f22-4a8b-b06a-eb4a3b68dd23`.
Verified folder: **HC - Fintech → Promo Simulator**, matching the supplied
portal link (`subfolderId=105685`). The deployed app, its SQL database and SQL
analytics endpoint are in this folder.

- [Open the hosted simulator](https://full-vista-4abe08ccab-westus.webapp.fabricapps.net)
- [Open the Fabric app item](https://app.fabric.microsoft.com/groups/6d6350e8-6f22-4a8b-b06a-eb4a3b68dd23/appbackends/0a0dff2b-1f0a-43ce-8f87-40dcca185b5f)

```powershell
Set-Location app
npx rayfin up --dry-run --workspace-id 6d6350e8-6f22-4a8b-b06a-eb4a3b68dd23 --item-name hc-promo-simulator --json
npx rayfin up --workspace-id 6d6350e8-6f22-4a8b-b06a-eb4a3b68dd23 --item-name hc-promo-simulator --json
npx rayfin up status --json
```

Rayfin provisions the Fabric app, managed SQL data/API and protected static hosting.
No lakehouse, warehouse or semantic model is required for this synthetic-data
demo. Rayfin's CLI targets a workspace; place the parent app item in the requested
folder through Fabric after deployment (its child items move with it).
Do not use destructive schema flags or change capacity without reviewing the impact.

Deployment state, environment configuration and credentials are excluded from Git.
Never paste access tokens or passwords into source or chat.

## Data and model notes

Revenue is interest + fees + partner subsidy, **not** financed principal.
Interest is annual **flat** interest, not APR. Funding assumes 50% average
outstanding principal. Expected loss is principal × lifetime PD × LGD.
Only Home Credit's assumed share of discounts is promotion expense.
Forgone interest under a zero-interest offer reduces revenue; it is not also
charged as a promotion expense. Tax, NPV, amortization, prepayment, delinquency
timing and non-accrual are not modeled.

The overview uses each store's latest saved draft, baseline elsewhere, and
normalizes campaign cohorts to 30 days. All results remain full loan-lifetime
estimates, not monthly accounting revenue. Reference campaign tags are
illustrative metadata and do not alter baseline economics.

Model v1.1 calculates each category independently, then sums store totals.
New demo plans use deterministic synthetic retail profiles rather than equal
category splits or repeated tickets. Home Living hubs are appliance-led,
Mobile Corners are phone-led, and Digital Hubs have a mixed product basket.
Hub volumes vary with fictional retail activity; category shares vary within each
hub while summing exactly to its total baseline loan volume. The store's displayed
average ticket is the volume-weighted category average, rounded to PHP 100.
These profiles are illustrative, not actual Home Credit pricing, measured
Philippine market data or inferred city demographics.

Starting category ticket ranges are PHP 22,000–62,000 for appliances,
7,500–36,000 for mobile phones, 28,000–85,000 for laptops, and 9,500–42,000
for electronics. Category/hub profiles also vary installment terms (3–12 months),
fees, partner subsidies, funding costs, default/loss assumptions, operating costs,
discount funding shares and planning budgets. Some low-margin category cohorts
can lose money. Unpromoted starts retain 30% annual flat interest, no discount,
no uplift and zero campaign spend; reference promotion tags remain metadata only.
Values are repeatable across refreshes and used consistently in the Overview,
hub comparison and new Studio plans. Existing saved snapshots are never reseeded.
Category volumes, tickets, campaign durations, terms, promotion assumptions,
fixed campaign spend and budgets are independently editable. Fixed spend is
charged once per category. Each category is normalized separately to 30 campaign
days in the Overview. Unsaved Studio edits do not change the Overview.
The Studio hub comparison uses the same latest-saved-draft/baseline source and
30-day normalization. It includes every hub in the selected city (or all 51
across Metro Manila), not just hubs with saved promotions. Unsaved editor changes
are excluded; changing comparison filters does not discard them. Opening a hub
loads its latest saved draft when present and replaces unsaved editor inputs.
Ranking is a comparison aid, not a forecast of incremental promotion returns.

Saved drafts retain the complete store/category-assumption snapshot and model version.
Existing v1.0 drafts are read compatibly: their original category retains all
volume, budget and fixed spend, with zero-volume plans for the other categories.
Their financial totals are unchanged; saving an edit writes the v1.1 format.
Comparisons show combined store totals plus category breakdowns. CSV exports
contain four category rows per selected draft, including category volumes,
tickets, terms, promotion settings, revenue, spend, budget and profit/loss.
Records are private to their creator; this demo has no approval or team-sharing
workflow.

Geographic boundaries use the high-resolution Metro Manila geometry from the
pinned Philippines JSON Maps v1.1.1 release, retaining detailed coastlines,
islands and city boundaries. Geometry is bundled locally; viewing the map
requires no external map service. It remains scoped to all 17 Metro Manila LGUs.
Regenerate centered, latitude-corrected SVG paths offline from the bundled source:
`node scripts/prepare-map.mjs` (from `app`).
See [third-party notices](app/THIRD-PARTY-NOTICES.txt). Boundaries are simplified
and are not for legal use.
