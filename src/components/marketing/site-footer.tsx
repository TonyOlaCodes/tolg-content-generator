import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-xl">DetailFlow</p>
          <p className="mt-2 max-w-md text-sm text-white/55">
            Turn enquiries into bookings. Built for Irish service businesses — starting with car detailers.
          </p>
        </div>
        <div className="space-y-2 text-sm text-white/60">
          <p className="font-medium text-white">Product</p>
          <Link href="/features">Features</Link>
          <br />
          <Link href="/pricing">Pricing</Link>
          <br />
          <Link href="/demo">Interactive demo</Link>
        </div>
        <div className="space-y-2 text-sm text-white/60">
          <p className="font-medium text-white">Legal</p>
          <Link href="/privacy">Privacy</Link>
          <br />
          <Link href="/terms">Terms</Link>
          <br />
          <Link href="/contact">Contact</Link>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/40">
        © {new Date().getFullYear()} DetailFlow. Prices shown are proposed and editable — not validated market rates.
      </div>
    </footer>
  );
}
