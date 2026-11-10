"use client";

import { useEffect, useRef, useState } from "react";
import {
  createBlock,
  newId,
  summarizeChecklist,
  tableColumnSums,
  type Block,
  type BlockKind,
  type ChecklistBlock,
  type ChecklistItem,
  type HeadingBlock,
  type ListBlock,
  type ParagraphBlock,
  type TableBlock,
} from "@/notes/store";
import {
  completeCalculation,
  currencySymbol,
  formatAmount,
  formatMoney,
  parsePrice,
  type Currency,
} from "@/notes/calc";

const TOOLS: { kind: BlockKind; label: string; icon: string }[] = [
  { kind: "paragraph", label: "Text", icon: "T" },
  { kind: "heading", label: "Heading", icon: "H" },
  { kind: "bullets", label: "Bullets", icon: "•" },
  { kind: "numbers", label: "Numbers", icon: "1." },
  { kind: "checklist", label: "Checklist", icon: "☑" },
  { kind: "table", label: "Table", icon: "▦" },
];

export default function BlockEditor({
  blocks,
  onChange,
  currency,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  currency: Currency;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  useEffect(() => {
    if (!focusKey) return;
    const element = rootRef.current?.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`);
    if (element) {
      element.focus();
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.setSelectionRange(element.value.length, element.value.length);
      }
    }
    setFocusKey(null);
  }, [focusKey, blocks]);

  const replace = (next: Block) => onChange(blocks.map((block) => (block.id === next.id ? next : block)));

  const remove = (id: string) => {
    const next = blocks.filter((block) => block.id !== id);
    onChange(next.length ? next : [createBlock("paragraph")]);
  };

  const splitHeading = (block: HeadingBlock) => {
    const paragraph = createBlock("paragraph");
    const index = blocks.findIndex((item) => item.id === block.id);
    const next = [...blocks];
    next.splice(index + 1, 0, paragraph);
    onChange(next);
    setFocusKey(paragraph.id);
  };

  const addBlock = (kind: BlockKind) => {
    const onlyEmptyParagraph = blocks.length === 1 && blocks[0].kind === "paragraph" && blocks[0].text === "";
    const block = onlyEmptyParagraph ? { ...createBlock(kind), id: blocks[0].id } : createBlock(kind);
    onChange(onlyEmptyParagraph ? [block] : [...blocks, block]);
    setFocusKey(
      block.kind === "paragraph" || block.kind === "heading"
        ? block.id
        : block.kind === "checklist"
          ? `${block.id}:${block.items[0]?.id ?? 0}`
          : block.kind === "table"
            ? `${block.id}:0:0`
            : `${block.id}:0`,
    );
  };

  return (
    <div className="notes-blocks" ref={rootRef}>
      {blocks.map((block) => (
        <section className="notes-block" data-kind={block.kind} key={block.id}>
          {block.kind === "paragraph" ? (
            <ParagraphEditor block={block} onChange={replace} />
          ) : null}
          {block.kind === "heading" ? (
            <HeadingEditor block={block} onChange={replace} onSplit={() => splitHeading(block)} />
          ) : null}
          {block.kind === "bullets" || block.kind === "numbers" ? (
            <ListEditor block={block} onChange={replace} onFocus={setFocusKey} />
          ) : null}
          {block.kind === "checklist" ? (
            <ChecklistEditor block={block} onChange={replace} currency={currency} onFocus={setFocusKey} />
          ) : null}
          {block.kind === "table" ? <TableEditor block={block} onChange={replace} /> : null}
          <button
            type="button"
            className="notes-block-remove"
            aria-label="Remove this section"
            onClick={() => remove(block.id)}
          >
            ×
          </button>
        </section>
      ))}

      <div className="notes-toolbar" role="toolbar" aria-label="Formatting">
        {TOOLS.map((tool) => (
          <button
            key={tool.kind}
            type="button"
            className="notes-tool"
            aria-label={`Insert ${tool.label.toLowerCase()}`}
            onClick={() => addBlock(tool.kind)}
          >
            <span className="notes-tool-icon" aria-hidden="true">{tool.icon}</span>
            <span className="notes-tool-label">{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ParagraphEditor({ block, onChange }: { block: ParagraphBlock; onChange: (block: ParagraphBlock) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [block.text]);

  return (
    <textarea
      ref={ref}
      className="notes-block-text"
      value={block.text}
      rows={1}
      placeholder="Start writing…"
      aria-label="Text"
      onChange={(event) => {
        const element = event.target;
        const finished = completeCalculation(element.value, element.selectionStart ?? element.value.length);
        if (finished) {
          onChange({ ...block, text: finished.text });
          requestAnimationFrame(() => {
            const input = ref.current;
            if (!input) return;
            input.focus();
            input.setSelectionRange(finished.caret, finished.caret);
          });
          return;
        }
        onChange({ ...block, text: element.value });
      }}
    />
  );
}

function HeadingEditor({
  block,
  onChange,
  onSplit,
}: {
  block: HeadingBlock;
  onChange: (block: HeadingBlock) => void;
  onSplit: () => void;
}) {
  return (
    <textarea
      className="notes-block-text notes-heading-input"
      value={block.text}
      rows={1}
      placeholder="Heading"
      aria-label="Heading"
      onChange={(event) => onChange({ ...block, text: event.target.value })}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onSplit();
        }
      }}
    />
  );
}

function ListEditor({
  block,
  onChange,
  onFocus,
}: {
  block: ListBlock;
  onChange: (block: ListBlock) => void;
  onFocus: (key: string) => void;
}) {
  const setItem = (index: number, text: string) =>
    onChange({ ...block, items: block.items.map((item, i) => (i === index ? text : item)) });

  const addAfter = (index: number) => {
    const items = [...block.items];
    items.splice(index + 1, 0, "");
    onChange({ ...block, items });
    onFocus(`${block.id}:${index + 1}`);
  };

  const removeAt = (index: number) => {
    const items = block.items.length === 1 ? [""] : block.items.filter((_, i) => i !== index);
    onChange({ ...block, items });
    if (block.items.length > 1) onFocus(`${block.id}:${Math.max(0, index - 1)}`);
  };

  return (
    <div className="notes-items">
      {block.items.map((item, index) => (
        <div className="notes-item-row" key={`${block.id}-${index}`}>
          <span className="notes-item-mark" aria-hidden="true">
            {block.kind === "numbers" ? `${index + 1}.` : "•"}
          </span>
          <input
            className="notes-item-input"
            data-focus={`${block.id}:${index}`}
            value={item}
            placeholder="List item"
            aria-label={`Item ${index + 1}`}
            onChange={(event) => setItem(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addAfter(index);
              } else if (event.key === "Backspace" && item === "" && block.items.length > 1) {
                event.preventDefault();
                removeAt(index);
              }
            }}
          />
          <button
            type="button"
            className="notes-item-remove"
            aria-label="Remove item"
            onClick={() => removeAt(index)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="notes-add-item" onClick={() => addAfter(block.items.length - 1)}>
        + Item
      </button>
    </div>
  );
}

function ChecklistEditor({
  block,
  onChange,
  currency,
  onFocus,
}: {
  block: ChecklistBlock;
  onChange: (block: ChecklistBlock) => void;
  currency: Currency;
  onFocus: (key: string) => void;
}) {
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const summary = summarizeChecklist(block.items);
  const [showPrices, setShowPrices] = useState(summary.hasPrices);

  const patchItem = (index: number, patch: Partial<ChecklistItem>) =>
    onChange({ ...block, items: block.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  const addAfter = (index: number) => {
    const item: ChecklistItem = { id: newId(), text: "", done: false };
    const items = [...block.items];
    items.splice(index + 1, 0, item);
    onChange({ ...block, items });
    onFocus(`${block.id}:${item.id}`);
  };

  const removeAt = (index: number) => {
    const items =
      block.items.length === 1
        ? [{ id: newId(), text: "", done: false }]
        : block.items.filter((_, i) => i !== index);
    onChange({ ...block, items });
  };

  const finishDrag = () => {
    if (drag && drag.over !== drag.from) {
      const items = [...block.items];
      const [moved] = items.splice(drag.from, 1);
      items.splice(drag.over, 0, moved);
      onChange({ ...block, items });
    }
    setDrag(null);
  };

  return (
    <div className="notes-checklist" data-dragging={drag ? "true" : undefined}>
      {block.items.map((item, index) => (
        <div
          className={`notes-check ${item.done ? "is-done" : ""} ${drag?.from === index ? "is-dragging" : ""} ${
            drag && drag.over === index && drag.from !== index ? "is-over" : ""
          }`}
          key={item.id}
          data-check-index={index}
        >
          <button
            type="button"
            className="notes-drag"
            aria-label="Drag to reorder"
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDrag({ from: index, over: index });
            }}
            onPointerMove={(event) => {
              if (!drag) return;
              const target = document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<HTMLElement>("[data-check-index]");
              if (!target) return;
              const over = Number(target.dataset.checkIndex);
              if (Number.isInteger(over) && over !== drag.over) setDrag({ ...drag, over });
            }}
            onPointerUp={finishDrag}
            onPointerCancel={() => setDrag(null)}
          >
            ⠿
          </button>
          <label className="notes-checkbox">
            <input
              type="checkbox"
              checked={item.done}
              aria-label={`Done: ${item.text || `item ${index + 1}`}`}
              onChange={(event) => patchItem(index, { done: event.target.checked })}
            />
            <span aria-hidden="true">✓</span>
          </label>
          <input
            className="notes-item-input"
            data-focus={`${block.id}:${item.id}`}
            value={item.text}
            placeholder="To do"
            aria-label={`To do ${index + 1}`}
            onChange={(event) => patchItem(index, { text: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addAfter(index);
              } else if (event.key === "Backspace" && item.text === "" && block.items.length > 1) {
                event.preventDefault();
                removeAt(index);
              }
            }}
          />
          {showPrices ? <PriceInput item={item} currency={currency} onPatch={(patch) => patchItem(index, patch)} /> : null}
          <button
            type="button"
            className="notes-item-remove"
            aria-label="Remove item"
            onClick={() => removeAt(index)}
          >
            ×
          </button>
        </div>
      ))}
      <div className="notes-checklist-foot">
        <button type="button" className="notes-add-item" onClick={() => addAfter(block.items.length - 1)}>
          + Item
        </button>
        <button
          type="button"
          className="notes-mini"
          aria-pressed={showPrices}
          onClick={() => setShowPrices((value) => !value)}
        >
          {showPrices ? "€ Prices" : "€ Add prices"}
        </button>
      </div>

      {summary.hasPrices ? (
        <div className="notes-summary" aria-live="polite">
          <span>
            <em>Total</em>
            <strong>{formatMoney(summary.total, currency)}</strong>
          </span>
          <span>
            <em>Remaining</em>
            <strong>{formatMoney(summary.remaining, currency)}</strong>
          </span>
          <span>
            <em>Completed</em>
            <strong>{formatMoney(summary.completed, currency)}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function PriceInput({
  item,
  currency,
  onPatch,
}: {
  item: ChecklistItem;
  currency: Currency;
  onPatch: (patch: Partial<ChecklistItem>) => void;
}) {
  const [text, setText] = useState(item.price != null ? formatAmount(item.price) : "");

  return (
    <span className="notes-price">
      <span aria-hidden="true">{currencySymbol(currency)}</span>
      <input
        value={text}
        inputMode="decimal"
        placeholder="—"
        aria-label={`Price for ${item.text || "item"}`}
        onChange={(event) => {
          setText(event.target.value);
          onPatch({ price: parsePrice(event.target.value) });
        }}
        onBlur={() => {
          const parsed = parsePrice(text);
          setText(parsed !== null ? formatAmount(parsed) : "");
          onPatch({ price: parsed });
        }}
      />
    </span>
  );
}

function TableEditor({ block, onChange }: { block: TableBlock; onChange: (block: TableBlock) => void }) {
  const [showSums, setShowSums] = useState(false);
  const width = block.rows[0]?.length ?? 1;
  const sums = tableColumnSums(block.rows);
  const hasSums = sums.some((sum) => sum !== null);

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
                      data-focus={`${block.id}:${r}:${c}`}
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
          {showSums && hasSums ? (
            <tfoot>
              <tr>
                {sums.map((sum, index) => (
                  <td key={index}>{sum === null ? "" : formatAmount(sum)}</td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {showSums && hasSums ? <p className="notes-table-note">Column sums</p> : null}
      <div className="notes-table-tools">
        <button type="button" className="notes-mini" onClick={addRow}>+ Row</button>
        <button type="button" className="notes-mini" onClick={addColumn}>+ Column</button>
        <button type="button" className="notes-mini" onClick={removeRow} disabled={block.rows.length <= 1}>− Row</button>
        <button type="button" className="notes-mini" onClick={removeColumn} disabled={width <= 1}>− Column</button>
        <button
          type="button"
          className="notes-mini"
          aria-pressed={showSums}
          disabled={!hasSums}
          onClick={() => setShowSums((value) => !value)}
        >
          Σ Sum
        </button>
      </div>
    </>
  );
}
