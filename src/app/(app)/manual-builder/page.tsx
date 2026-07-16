import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ManualBuilderPage() {
  const disabledReason =
    "Manual Builder arrives in Phase 3. Prepare media in the library first.";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Manual Builder
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Assemble posts by hand with full control over media and text.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 3</CardTitle>
          <CardDescription>
            The manual composition UI is planned for Phase 3. Use Phase 1 to
            upload and tag media so you are ready when the builder unlocks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" disabled title={disabledReason}>
            Open builder
          </Button>
          <p className="text-sm text-zinc-500">{disabledReason}</p>
          <Button asChild variant="secondary">
            <Link href="/media">Browse media library</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
