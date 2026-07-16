import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMediaStats } from "@/server/services/media/library";

export default async function DashboardPage() {
  const user = await requireUser();
  const userId = user.id!;

  const [stats, recentDrafts, recentExports, recentJobs] = await Promise.all([
    getMediaStats(userId),
    prisma.draft.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.exportRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        platform: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.renderJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        draft: { select: { name: true } },
      },
    }),
  ]);

  const statCards = [
    { label: "Theme images", value: stats.theme },
    { label: "Physique photos", value: stats.physique },
    { label: "Music tracks", value: stats.music },
    { label: "Drafts", value: stats.drafts },
    { label: "Approved", value: stats.approved },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Overview of your media library and generation pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/auto-generate">Auto Generate</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/manual-builder">Manual Builder</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/upload">Upload media</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent drafts</CardTitle>
            <CardDescription>
              Drafts appear after Phase 2 generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentDrafts.length === 0 ? (
              <p className="text-sm text-zinc-500">No drafts yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentDrafts.map((draft) => (
                  <li key={draft.id}>
                    <Link
                      href={`/drafts/${draft.id}`}
                      className="flex items-center justify-between gap-2 text-sm hover:text-white"
                    >
                      <span className="truncate text-zinc-200">{draft.name}</span>
                      <Badge>{draft.status}</Badge>
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {formatDistanceToNow(draft.createdAt, { addSuffix: true })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent exports</CardTitle>
            <CardDescription>Export history from Phase 4.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentExports.length === 0 ? (
              <p className="text-sm text-zinc-500">No exports yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentExports.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate text-zinc-200">{item.platform}</span>
                    <Badge>{item.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Render jobs</CardTitle>
            <CardDescription>Video renders from Phase 4.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-zinc-500">No render jobs yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentJobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate text-zinc-200">
                      {job.draft.name}
                    </span>
                    <Badge>{job.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
