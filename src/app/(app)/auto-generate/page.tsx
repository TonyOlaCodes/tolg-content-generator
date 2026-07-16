import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AutoGeneratePage() {
  const disabledReason =
    "Requires Phase 2 generation engine. Upload media in Phase 1 first.";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Auto Generate
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Automatically create draft posts from your media library.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 2</CardTitle>
          <CardDescription>
            The generation engine — hook matching, photo pairing, and draft
            creation — ships in Phase 2. For now, build your media library so
            generation has assets to work with.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" disabled title={disabledReason} className="w-full sm:w-auto">
            Generate drafts
          </Button>
          <p className="text-sm text-zinc-500">{disabledReason}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/upload">Upload media</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/media">Open media library</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
