"use client";

import {
  createBlock,
  newId,
  type Block,
  type BlockKind,
  type ChecklistBlock,
  type ListBlock,
  type ParagraphBlock,
  type TableBlock,
} from "@/notes/store";

const KIND_LABELS: Record<BlockKind, string> = {
  paragraph: "Text",
  bullets: "Bullets",
  numbers: "Numbered list",
  checklist: "Checklist",
  table: "Table",
};

const KINDS: BlockKind[] = ["paragraph", "bullets", "numbers", "checklist", "table"];

export default function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange: (blocks: Block[]) => void }) {
  const replace = (next: Block) => onChange(blocks.map((block) => (block.id === next.id ? next : block)));
  const remove = (id: string) => onChange(blocks.filter((block) => block.id !== id));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [block] = next.splice(index, 1);
    next.splice(target, 0, block);
    onChange(next);
  };

  return (
    <div className="notes-blocks">
      {blocks.length === 0 ? (
        <p className="notes-muted">Nothing here yet. Add text, a list, a checklist or a table below.</p>
      ) : null}

      {blocks.map((block, index) => (
        <section className="notes-block" key={block.id} aria-label={KIND_LABELS[block.kind]}>
          <header className="notes-block-head">
            <span className="notes-block-kind">{KIND_LABELS[block.kind]}</span>
            <span className="notes-block-tools">
              <button type="button" aria-label="Move section up" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
              <button type="button" aria-label="Move section down" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}>↓</button>
              <button type="button" aria-label="Delete section" onClick={() => remove(block.id)}>×</button>
            </span>
          </header>

          {block.kind === "paragraph" ? <ParagraphEditor block={block} onChange={replace} /> : null}
          {block.kind === "bullets" || block.kind === "numbers" ? <ListEditor block={block} onChange={replace} /> : null}
          {block.kind === "checklist" ? <ChecklistEditor block={block} onChange={replace} /> : null}
          {block.kind === "table" ? <TableEditor block={block} onChange={replace} /> : null}
        </section>
      ))}

      <div className="notes-add-block">
        <span className="notes-add-label">Add</span>
        {KINDS.map((kind) => (
          <button key={kind} type="button" className="notes-chip" onClick={() => onChange([...blocks, createBlock(kind)])}>
            + {KIND_LABELS[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ParagraphEditor({ block, onChange }: { block: ParagraphBlock; onChange: (block: ParagraphBlock) => void }) {
  const lines = block.text ? block.text.split("\n").length : 1;
  return (
    <textarea
      className="notes-block-text"
      value={block.text}
      rows={Math.min(10, Math.max(2, lines))}
      placeholder="Write something…"
      aria-label="Text"
      onChange={(event) => onChange({ ...block, text: event.target.value })}
    />
  );
}

function ListEditor({ block, onChange }: { block: ListBlock; onChange: (block: ListBlock) => void }) {
  const setItem = (index: number, text: string) =>
    onChange({ ...block, items: block.items.map((item, i) => (i === index ? text : item)) });
  const removeItem = (index: number) =>
    onChange({ ...block, items: block.items.length === 1 ? [""] : block.items.filter((_, i) => i !== index) });

  return (
    <div className="notes-items">
      {block.items.map((item, index) => (
        <div className="notes-item-row" key={index}>
          <span className="notes-item-mark">{block.kind === "numbers" ? `${index + 1}.` : "•"}</span>
          <input
            className="notes-item-input"
            value={item}
            placeholder="List item"
            aria-label={`Item ${index + 1}`}
            onChange={(event) => setItem(index, event.target.value)}
          />
          <button type="button" className="notes-item-remove" aria-label="Remove item" onClick={() => removeItem(index)}>×</button>
        </div>
      ))}
      <button type="button" className="notes-add-item" onClick={() => onChange({ ...block, items: [...block.items, ""] })}>
        + Add item
      </button>
    </div>
  );
}

function ChecklistEditor({ block, onChange }: { block: ChecklistBlock; onChange: (block: ChecklistBlock) => void }) {
  const patchItem = (index: number, patch: Partial<ChecklistBlock["items"][number]>) =>
    onChange({ ...block, items: block.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const removeItem = (index: number) => {
    const items = block.items.length === 1 ? [{ id: newId(), text: "", done: false }] : block.items.filter((_, i) => i !== index);
    onChange({ ...block, items });
  };

  return (
    <div className="notes-checklist">
      {block.items.map((item, index) => (
        <div className={`notes-check ${item.done ? "is-done" : ""}`} key={item.id}>
          <input
            type="checkbox"
            checked={item.done}
            aria-label={`Done: ${item.text || `item ${index + 1}`}`}
            onChange={(event) => patchItem(index, { done: event.target.checked })}
          />
          <input
            className="notes-item-input"
            value={item.text}
            placeholder="To do"
            aria-label={`To do ${index + 1}`}
            onChange={(event) => patchItem(index, { text: event.target.value })}
          />
          <button type="button" className="notes-item-remove" aria-label="Remove item" onClick={() => removeItem(index)}>×</button>
        </div>
      ))}
      <button
        type="button"
        className="notes-add-item"
        onClick={() => onChange({ ...block, items: [...block.items, { id: newId(), text: "", done: false }] })}
      >
        + Add item
      </button>
    </div>
  );
}

function TableEditor({ block, onChange }: { block: TableBlock; onChange: (block: TableBlock) => void }) {
  const width = block.rows[0]?.length ?? 1;
  const setCell = (row: number, column: number, value: string) =>
    onChange({
      ...block,
      rows: block.rows.map((cells, r) => (r === row ? cells.map((cell, c) => (c === column ? value : cell)) : cells)),
    });
  const addRow = () => onChange({ ...block, rows: [...block.rows, Array.from({ length: width }, () => "")] });
  const addColumn = () => onChange({ ...block, rows: block.rows.map((row) => [...row, ""]) });
  const removeRow = () => {
    if (block.rows.length > 1) onChange({ ...block, rows: block.rows.slice(0, -1) });
  };
  const removeColumn = () => {
    if (width > 1) onChange({ ...block, rows: block.rows.map((row) => row.slice(0, -1)) });
  };

  return (
    <>
      <div className="notes-table-wrap">
        <table className="notes-table">
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className={r === 0 ? "is-header" : undefined}>
                    <input
                      value={cell}
                      placeholder={r === 0 ? `Column ${c + 1}` : ""}
                      aria-label={`Row ${r + 1}, column ${c + 1}`}
                      onChange={(event) => setCell(r, c, event.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="notes-table-tools">
        <button type="button" className="notes-chip" onClick={addRow}>+ Row</button>
        <button type="button" className="notes-chip" onClick={addColumn}>+ Column</button>
        <button type="button" className="notes-chip" onClick={removeRow} disabled={block.rows.length <= 1}>− Row</button>
        <button type="button" className="notes-chip" onClick={removeColumn} disabled={width <= 1}>− Column</button>
      </div>
    </>
  );
}
