"use client";

import { VaMember } from "@/lib/api";

type Props = {
  vas: VaMember[];
  value: number | null | undefined;
  onChange: (vaId: number | null) => void;
  disabled?: boolean;
};

export function VaSelect({ vas, value, onChange, disabled }: Props) {
  return (
    <select
      className="va-select"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value;
        onChange(next ? Number(next) : null);
      }}
    >
      <option value="">— Aucun VA —</option>
      {vas.map((va) => (
        <option key={va.id} value={va.id}>
          {va.emoji ? `${va.emoji} ` : ""}{va.name}
        </option>
      ))}
    </select>
  );
}
