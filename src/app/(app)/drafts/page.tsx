import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DraftsPage() {
  const user = await requireUser();
  const drafts = await prisma.draft.findMany({
    where: { userId: user.id! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      generationMode: true,
      hookText: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Drafts
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Review and manage generated or manually built posts.
        </p>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No drafts yet</CardTitle>
            <CardDescription>
              Phase 2 auto-generation creates drafts from your media library.
              Upload and tag assets in Phase 1, then generate when Phase 2 is
              ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/upload">Upload media</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auto-generate">Auto Generate</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                href={`/drafts/${draft.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-zinc-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium text-zinc-100">{draft.name}</h2>
                  <div className="flex gap-2">
                    <Badge>{draft.status}</Badge>
                    <Badge variant="warning">{draft.generationMode}</Badge>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                  {draft.hookText}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Updated{" "}
                  {formatDistanceToNow(draft.updatedAt, { addSuffix: true })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
