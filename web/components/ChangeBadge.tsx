type Props = {
  pct: number | null | undefined;
};

export function ChangeBadge({ pct }: Props) {
  if (pct == null || Number.isNaN(pct)) {
    return <span className="hint">—</span>;
  }

  const up = pct >= 0;
  return (
    <span className={`change-badge ${up ? "change-up" : "change-down"}`}>
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}
