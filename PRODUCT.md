# Product

## Register

product

## Users

Dubai real-estate brokers and consumers comparing current market activity with valuation evidence. Brokers need a fast way to shortlist conversations and investigate unusual deals; consumers need understandable signals that help them recognize when a recorded price appears materially below comparable valuation benchmarks.

## Product Purpose

Turn Dubai transaction, valuation, and project records into a practical opportunity-discovery dashboard. Success means a user can filter to a relevant market segment, compare price momentum by area, developer, project, or property type, identify potentially undervalued transactions, and inspect the underlying evidence without needing a separate analysis tool.

## Brand Personality

Sober, editorial, and commercially confident. The interface should feel data-literate and trustworthy while remaining approachable to non-specialists.

## Anti-references

Avoid speculative trading aesthetics, decorative gradients, glass-heavy dashboards, excessive badges, and opaque scores that make uncertain market evidence appear definitive. Avoid dense enterprise reporting screens that provide data without a clear investigative path.

## Design Principles

1. Lead with evidence: every opportunity signal must expose its transaction price, benchmark, cohort size, and comparison basis.
2. Make uncertainty legible: distinguish strong local valuation cohorts from broader fallback benchmarks and avoid presenting an estimate as a formal appraisal.
3. Filter before explaining: users should be able to narrow the market quickly, then see every KPI and chart respond consistently.
4. Progress from signal to source: high-level KPIs should lead naturally to ranked opportunities and then to the underlying transaction and valuation records.
5. Prefer commercial clarity over visual novelty: use restrained Material UI patterns, disciplined color, and concise market language.
6. Keep signals independent: transaction price trends and valuation-backed opportunity scores must expose separate methodologies and never be blended into an opaque composite.
7. Treat mapped locations as context: area centroids are approximate and must never imply exact project, building, or unit coordinates.
8. Offer a top-bar AED/sq.ft or AED/sq.m selector, defaulting to square feet and remembering the browser preference. Convert price and area displays, chart values, table filters and exports together. Preserve source data, analytics, and area-filter bounds in square metres so changing units does not change the selected records or scores.
9. Treat transaction freshness as a backend responsibility. The portal reads current transaction observations from the Azure API when configured and shows the bundled snapshot only when the API is unavailable during rollout or recovery.
10. Keep personal evidence separate from data quality decisions. A signed-in user's favorites are private purchase-planning references; reviewer dislikes are global moderation decisions that remove a transaction from dashboard analysis.

## Transaction Data Operations

The production sources are the Dubai Land Department transaction export, projects, and valuations endpoints. An Azure Functions timer requests each feed every Monday and Thursday at 02:15 UTC and stores dashboard-relevant fields in Azure SQL. A three-day transaction overlap captures late changes. The importer keeps historical transaction and valuation observations, uses source identities plus canonical row hashes for idempotency, and exposes only current observations to the public read API.

The portal never calls the Dubai Land Department endpoints directly. Public browser requests go to the Azure read API. The Function App connects to Azure SQL with its managed identity, so no database password is stored in the application.

## Evidence Actions

Authenticated users can favorite a transaction anywhere transaction evidence is shown, including the Transactions tab, valuation-opportunity details, and Area, Developer, Project, or Property Type trend dialogs. Favorites are stored per Supabase user in Azure SQL and can be revisited with the **Saved only** filter in the Transactions tab. Saving a favorite does not alter analytics or make it visible to another user.

Like and dislike remain reviewer-only actions. A dislike records an auditable global moderation decision and excludes that transaction from all dashboard calculations and evidence views. Review permissions are derived from the authenticated user and are not implied by the ability to save a favorite.

## Accessibility & Inclusion

This MVP relies on Material UI's standard semantic controls, focus behavior, and responsive layouts. A dedicated WCAG compliance and assistive-technology pass is intentionally deferred to a later phase.
