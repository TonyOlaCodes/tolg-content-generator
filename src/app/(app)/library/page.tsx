"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { REFERENCES } from "@/lib/data/references";
import { WORDS } from "@/lib/data/words";

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Library</h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          High-quality references and words — facts first, wordplay routes second.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/library/references">
          <Card interactive className="!p-5">
            <p className="font-display text-2xl">{REFERENCES.length}</p>
            <p className="text-sm text-[var(--text-secondary)]">References</p>
          </Card>
        </Link>
        <Link href="/library/words">
          <Card interactive className="!p-5">
            <p className="font-display text-2xl">{WORDS.length}</p>
            <p className="text-sm text-[var(--text-secondary)]">Words</p>
          </Card>
        </Link>
      </div>
      <Link href="/home">
        <Card interactive>
          <p className="font-medium">Reference of the Day</p>
          <p className="text-sm text-[var(--text-secondary)]">Quiz yourself from the Home dashboard.</p>
        </Card>
      </Link>
    </div>
  );
}
