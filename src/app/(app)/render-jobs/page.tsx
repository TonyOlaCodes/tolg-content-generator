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

export default async function RenderJobsPage() {
  const user = await requireUser();
  const jobs = await prisma.renderJob.findMany({
    where: { userId: user.id! },
    orderBy: { createdAt: "desc" },
    include: {
      draft: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Render Jobs
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Video render queue status for Instagram Reels and related outputs.
        </p>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No render jobs</CardTitle>
            <CardDescription>
              Render jobs are created in Phase 4 when exports are sent to the
              render worker. Configure RENDER_WORKER_URL under Connections when
              you are ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/connections">Connections</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/drafts">View drafts</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <div>
                <p className="font-medium text-zinc-100">{job.draft.name}</p>
                <p className="text-xs text-zinc-500">
                  {job.workerTarget} ·{" "}
                  {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                </p>
                {job.errorMessage ? (
                  <p className="mt-1 text-xs text-red-400">{job.errorMessage}</p>
                ) : null}
              </div>
              <Badge
                variant={
                  job.status === "FAILED"
                    ? "danger"
                    : job.status === "COMPLETED"
                      ? "success"
                      : "default"
                }
              >
                {job.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
