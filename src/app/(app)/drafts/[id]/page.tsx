import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type DraftDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DraftDetailPage({ params }: DraftDetailPageProps) {
  const { id } = await params;
  const user = await requireUser();

  const draft = await prisma.draft.findFirst({
    where: { id, userId: user.id! },
    include: {
      mediaItems: {
        orderBy: { position: "asc" },
        include: {
          mediaAsset: {
            select: {
              id: true,
              fileName: true,
              thumbnailUrl: true,
              storageUrl: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!draft) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/drafts">← Back to drafts</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {draft.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Created {format(draft.createdAt, "MMM d, yyyy HH:mm")}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge>{draft.status}</Badge>
          <Badge variant="warning">{draft.generationMode}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview shell</CardTitle>
          <CardDescription>
            Full canvas editing arrives with Phase 2/3. This view shows stored
            draft fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Hook</p>
            <p className="mt-1 whitespace-pre-wrap text-zinc-100">
              {draft.hookText}
            </p>
          </div>
          <Separator />
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Caption
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
              {draft.socialCaption}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Hashtags
            </p>
            <p className="mt-1 text-sm text-zinc-400">{draft.hashtags}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-zinc-500">Text position</p>
              <p className="text-sm text-zinc-200">{draft.textPosition}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Alignment</p>
              <p className="text-sm text-zinc-200">{draft.textAlignment}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media slots</CardTitle>
          <CardDescription>
            {draft.mediaItems.length === 0
              ? "No media attached to this draft yet."
              : `${draft.mediaItems.length} item(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {draft.mediaItems.length === 0 ? (
            <p className="text-sm text-zinc-500">Empty media list.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {draft.mediaItems.map((item) => (
                <li
                  key={item.id}
                  className="overflow-hidden rounded-lg border border-zinc-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      item.mediaAsset.thumbnailUrl ??
                      item.mediaAsset.storageUrl
                    }
                    alt={item.mediaAsset.fileName}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="p-2">
                    <p className="truncate text-xs text-zinc-300">
                      {item.mediaAsset.fileName}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      #{item.position} · {item.role}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled
          title="Editing unlocks with Phase 2/3 draft tools."
        >
          Edit draft
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled
          title="Export requires Phase 4."
        >
          Export
        </Button>
      </div>
    </div>
  );
}
