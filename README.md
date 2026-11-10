# tolg-content-generator

A Next.js mini-app collection that opens from one home screen:

- **Weather**: forecasts worldwide.
- **Fuel Tracker**: car fuel records, costs and analytics.
- **Money Tracker**: accounts, pockets, money movements, bills, scheduled income, refunds and IOUs.
- **Groceries & Pantry**: stock, meals and shopping.
- **Notes**: folders and subfolders, rich sections (lists, checklists, tables), colours and optional password locks.
- **Daily Tracker**: steps, bodyweight, calories, sleep and water with goals, history
  and trends.

## Scripts

- `npm run dev`: start the development server.
- `npm run build`: build for production.
- `npm start`: serve the production build.
- `npm test`: run the Weather, Fuel, Money, Groceries, Notes and Daily Tracker tests.
- `npm run lint` and `npm run typecheck`: lint and type-check.

## Notes

Notes are stored only in this browser. Folders can hold subfolders one level deep, and a note
can mix text, bullet or numbered lists, checklists and tables. Notes and folders can take a
colour.

A note can be locked with a password: its sections are encrypted with AES-GCM before they are
saved, while the title, folder and colour stay visible. There is no password recovery. Use the
Data button in Notes to export a JSON backup; folders, colours and sections are included, and
locked notes stay encrypted, so the password is still needed to read them.

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
