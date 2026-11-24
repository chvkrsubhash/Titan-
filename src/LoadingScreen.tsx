export function LoadingScreen({ label = "Opening workspace…" }: { label?: string }) {
  return (
    <main role="status" className="titan-loading">
      <img src="/titan-logo.png" alt="Titan" width="160" height="160" />
      <span>{label}</span>
    </main>
  );
}
