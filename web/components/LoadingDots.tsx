export function LoadingDots({ label = "Chargement" }: { label?: string }) {
  return (
    <p className="loading-dots" role="status" aria-live="polite">
      <span className="loading-dots-label">{label}</span>
      <span className="loading-dots-track" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </p>
  );
}
