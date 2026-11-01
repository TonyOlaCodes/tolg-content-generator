"use client";

import { useMemo, useState } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { formatBase, type ListItem } from "@/groceries/model";
import { lineCents, listEstimate } from "@/groceries/logic";
import { formatEUR, parseEuroToCents } from "@/money/money";
import { markPurchased, unmarkPurchased, removeItem, upsertItem, newId, todayLocal } from "@/groceries/actions";
import { activeList } from "./shared";
import { FinishSheet } from "./FinishSheet";

export default function ShoppingPage({ api }: { api: GroceriesApi }) {
  const { snap, act, notify } = api;
  const list = activeList(snap);
  const [name, setName] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const items = useMemo(() => snap.items.filter((i) => i.listId === list?.id), [snap.items, list?.id]);
  const open = items.filter((i) => !i.purchased);
  const done = items.filter((i) => i.purchased);
  const est = listEstimate(open);
  const shop = snap.shops.find((s) => s.id === list?.shopId);

  if (!list) {
    return <p className="gr-muted">No shopping list yet. It will appear after the app finishes setting up.</p>;
  }

  const addManual = async () => {
    const n = name.trim();
    if (!n) return;
    const item: ListItem = {
      id: newId(), listId: list.id, foodId: null, name: n, measure: null,
      packs: 1, packBase: 1, unitCents: null, purchased: false, actualCents: null,
      purchaseId: null, version: 1, createdAt: new Date().toISOString(),
    };
    const err = await act(upsertItem(item));
    if (err) return notify(err);
    setName("");
  };

  const setPacks = async (item: ListItem, packs: number) => {
    if (packs < 1) return;
    const err = await act(upsertItem({ ...item, packs }));
    if (err) notify(err);
  };

  const setPrice = async (item: ListItem, text: string) => {
    const cents = text.trim() === "" ? null : parseEuroToCents(text);
    if (text.trim() !== "" && cents === null) return notify("Enter the price in euro, e.g. 1.75.");
    const err = await act(upsertItem({ ...item, unitCents: cents }));
    if (err) notify(err);
  };

  const tick = async (item: ListItem) => {
    const err = await act(markPurchased(item.id, null, todayLocal()));
    notify(err ?? "Marked bought. Stock updated.");
  };

  const untick = async (item: ListItem) => {
    const err = await act(unmarkPurchased(item.id));
    notify(err ?? "Purchase undone. Stock reverted.");
  };

  const remove = async (item: ListItem) => {
    const err = await act(removeItem(item.id));
    notify(err ?? "Removed");
  };

  return (
    <div className="gr-stack">
      <div className="gr-search">
        <input
          className="gr-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
          placeholder="Add an item and press Enter"
          aria-label="Add shopping item"
        />
        <button className="gr-chip" onClick={addManual} disabled={!name.trim()}>Add</button>
      </div>
      <p className="gr-muted gr-small">{list.name}{shop ? ` · ${shop.name}` : ""}</p>

      <section className="gr-total">
        <span className="gr-kicker">Estimated total</span>
        <span className="gr-total-value">{formatEUR(est.cents)}</span>
        {est.missing > 0 && <span className="gr-muted">{est.missing} item(s) without a saved price</span>}
      </section>

      {open.length === 0 ? (
        <div className="gr-card gr-empty">
          <p className="gr-h3">{done.length ? "Everything is bought" : "Your list is empty"}</p>
          <p className="gr-muted">Add items above, or tap Add to Shopping List on a low food in Pantry or Home.</p>
        </div>
      ) : (
        <ul className="gr-list">
          {open.map((item) => (
            <li key={item.id} className="gr-shop-row">
              <button className="gr-check" onClick={() => tick(item)} aria-label={`Mark ${item.name} as bought`} />
              <div className="gr-row-main">
                <span className="gr-name">{item.name}</span>
                <span className="gr-muted">
                  {item.foodId && item.measure ? `${formatBase(item.packBase, item.measure)} per pack` : "Not tracked in pantry"}
                  {" · "}
                  {item.unitCents === null ? "no price" : `${formatEUR(item.unitCents)} each`}
                </span>
                <div className="gr-line-edit">
                  <div className="gr-stepper">
                    <button onClick={() => setPacks(item, item.packs - 1)} disabled={item.packs <= 1} aria-label="Fewer packs">−</button>
                    <span className="gr-stepper-value" aria-label="Packs">{item.packs}</span>
                    <button onClick={() => setPacks(item, item.packs + 1)} aria-label="More packs">+</button>
                  </div>
                  <PriceInput cents={item.unitCents} onSave={(t) => setPrice(item, t)} />
                </div>
              </div>
              <div className="gr-line-total">
                <span>{lineCents(item) === null ? "—" : formatEUR(lineCents(item)!)}</span>
                <button className="gr-link is-danger" onClick={() => remove(item)} aria-label={`Remove ${item.name}`}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section className="gr-card">
          <button className="gr-row-head gr-collapse" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            <span className="gr-h3">Bought ({done.length})</span>
            <span className="gr-muted">{showDone ? "Hide" : "Show"}</span>
          </button>
          {showDone && (
            <ul className="gr-list">
              {done.map((item) => (
                <li key={item.id} className="gr-row is-done">
                  <span className="gr-name">{item.name} × {item.packs}</span>
                  <span className="gr-muted">{item.actualCents !== null ? formatEUR(item.actualCents) : ""}</span>
                  <button className="gr-chip" onClick={() => untick(item)}>Undo</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {done.length > 0 && (
        <button className="gr-primary" onClick={() => setFinishing(true)}>Finish Shopping</button>
      )}

      {finishing && <FinishSheet api={api} listId={list.id} onClose={() => setFinishing(false)} />}
    </div>
  );
}

function PriceInput({ cents, onSave }: { cents: number | null; onSave: (text: string) => void }) {
  const [text, setText] = useState(cents === null ? "" : (cents / 100).toFixed(2));
  return (
    <label className="gr-price">
      <span className="gr-muted">€</span>
      <input
        className="gr-input is-compact"
        inputMode="decimal"
        value={text}
        placeholder="price"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text)}
        aria-label="Price per pack in euro"
      />
    </label>
  );
}
