# tolg-content-generator

A Next.js mini-app collection that opens from one home screen:

- **Weather**: forecasts worldwide.
- **Fuel Tracker**: car fuel records, costs and analytics.
- **Money Tracker**: accounts, budgets, bills and forecasts.
- **Groceries & Pantry**: stock, meals and shopping.
- **Daily Tracker**: steps, bodyweight, calories, sleep and water with goals, history
  and trends.

## Scripts

- `npm run dev`: start the development server.
- `npm run build`: build for production.
- `npm start`: serve the production build.
- `npm test`: run the Weather, Fuel, Money, Groceries and Daily Tracker tests.
- `npm run lint` and `npm run typecheck`: lint and type-check.

## Daily Tracker

Daily Tracker is local-first. Entries are stored in this browser with IndexedDB under the
`detailflows-daily` database, keyed by the local calendar date. No account is required and
nothing is sent to a server.

- Today dashboard with editable metric cards, a date selector and quick daily logging.
- Steps, bodyweight (one weigh-in per day), calories, sleep and water.
- Calendar history and chart trends from recorded data only.
- Settings for goals, weight unit, chart period, card order/visibility and JSON backup.
- Missing data always stays missing, never zero.

Export a backup from Settings before clearing browser data; local-only records cannot be
recovered after site storage is erased.
