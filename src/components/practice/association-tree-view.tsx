"use client";

import type { AssociationNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AssociationTreeView({
  nodes,
  depth = 0,
}: {
  nodes: AssociationNode[];
  depth?: number;
}) {
  return (
    <ul className={cn("space-y-2", depth > 0 && "ml-3 border-l border-white/10 pl-3")}>
      {nodes.map((n) => (
        <TreeNode key={n.id} node={n} depth={depth} />
      ))}
    </ul>
  );
}

function TreeNode({ node, depth }: { node: AssociationNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasKids = Boolean(node.children?.length);
  return (
    <li>
      <button
        type="button"
        onClick={() => hasKids && setOpen((v) => !v)}
        className={cn(
          "rounded-xl px-3 py-2 text-left transition",
          hasKids ? "bg-white/5 hover:bg-white/10" : "text-[var(--text-secondary)]",
        )}
      >
        <span className="font-medium">{node.label}</span>
        {node.route && <span className="ml-2 text-xs text-[var(--text-muted)]">{node.route}</span>}
        {hasKids && <span className="ml-2 text-xs text-[var(--accent)]">{open ? "−" : "+"}</span>}
      </button>
      {open && node.children && <AssociationTreeView nodes={node.children} depth={depth + 1} />}
    </li>
  );
}
