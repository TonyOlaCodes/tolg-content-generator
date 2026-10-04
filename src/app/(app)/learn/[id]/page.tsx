"use client";

import { use } from "react";
import Link from "next/link";
import { getLesson } from "@/lib/data/lessons";
import { LessonPlayer } from "@/components/learn/lesson-player";
import { Button } from "@/components/ui/button";

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const lesson = getLesson(id);
  if (!lesson) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p>Lesson not found.</p>
        <Link href="/learn">
          <Button>Back</Button>
        </Link>
      </div>
    );
  }
  return <LessonPlayer lesson={lesson} />;
}
