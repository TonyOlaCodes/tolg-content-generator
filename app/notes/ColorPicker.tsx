"use client";

import { COLOR_LABELS, NOTE_COLORS, type NoteColor } from "@/notes/store";

export default function ColorPicker({ value, onChange }: { value: NoteColor; onChange: (color: NoteColor) => void }) {
  return (
    <div className="notes-swatches" role="group" aria-label="Colour">
      {NOTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className="notes-swatch"
          data-color={color}
          aria-label={COLOR_LABELS[color]}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
