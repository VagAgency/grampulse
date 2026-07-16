type Props = {
  status: string | null | undefined;
};

const MAP: Record<string, { label: string; className: string }> = {
  actif: { label: "Actif", className: "status-actif" },
  meilleur: { label: "Meilleur", className: "status-meilleur" },
  shadowban: { label: "Shadowban", className: "status-shadowban" },
  ban: { label: "Ban", className: "status-ban" },
};

export function StatusBadge({ status }: Props) {
  const item = MAP[status || ""] || { label: "—", className: "status-unknown" };
  return <span className={`status-badge ${item.className}`}>{item.label}</span>;
}
