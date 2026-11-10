# tolg-content-generator

A Next.js mini-app collection that opens from one home screen:

- **Weather**: forecasts worldwide.
- **Fuel Tracker**: car fuel records, costs and analytics.
- **Money Tracker**: accounts, pockets, money movements, bills, scheduled income, refunds and IOUs.
- **Groceries & Pantry**: stock, meals and shopping.
- **Notes**: a fast continuous editor with folders, lists, priced checklists, inline sums, pins and optional password locks.
- **Daily Tracker**: steps, bodyweight, calories, sleep and water with goals, history
  and trends.

## Scripts

- `npm run dev`: start the development server.
- `npm run build`: build for production.
- `npm start`: serve the production build.
- `npm test`: run the Weather, Fuel, Money, Groceries, Notes and Daily Tracker tests.
- `npm run lint` and `npm run typecheck`: lint and type-check.

## Notes

Notes are stored only in this browser. Folders can hold subfolders one level deep. A note is one
continuous page: the formatting bar adds text, headings, bullets, numbered lists, checklists and
tables, Enter continues a list, and changes save automatically. Notes and folders can take a
colour.

Checklist items can carry an optional price. When a checklist has prices, it shows Total,
Remaining and Completed automatically in euros (or another currency chosen for the note). Typing
a line that ends in `=` finishes simple arithmetic, and tables can show a sum for numeric columns.

Notes can be pinned, sorted by last edited, created date, name or manual order, duplicated, moved
between folders, copied or exported as plain text. Deleting a note offers an undo. A note can be
locked with a password: its content is encrypted with AES-GCM before it is saved, while the title,
folder and colour stay visible. There is no password recovery. Use the Data button in Notes to
export a JSON backup; folders, colours, prices, pins and content are included, and locked notes
stay encrypted, so the password is still needed to read them.

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
