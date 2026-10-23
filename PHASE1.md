# DetailFlow Phase 1 checklist

## Acceptance criteria

- [x] Business owner can register
- [x] Business workspace can be created (onboarding)
- [x] Services can be configured
- [x] Public booking-request URL generated (`/book/[slug]`)
- [x] Fictional customer can submit an enquiry
- [x] Enquiry persists in PostgreSQL
- [x] Owner can view and manage enquiries
- [x] Owner can convert enquiry to appointment
- [x] Appointment appears on calendar / bookings
- [x] Notifications previewed without Resend; sent when `RESEND_API_KEY` set
- [x] Interactive demo without registration (`/demo`, reset button)
- [x] Tenant isolation enforced server-side
- [x] Mobile-responsive dashboard (sidebar + bottom nav)
- [x] Production build succeeds
- [x] Deployment instructions in README

## Simulated / credential-gated

- Email: preview mode without Resend
- Stripe subscriptions: webhook stub + billing UI; no live charges without keys
- SMS / WhatsApp: interfaces only (not implemented)
- Advanced automation engine: rules stored; full scheduler is Phase 2

## Demo credentials (fictional)

- Owner: `demo@cleancar.ie` / `password123`
- Admin: `admin@detailflow.ie` / `password123`
- Public booking: `/book/cleancar-demo`
