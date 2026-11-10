/** Shown while an admin page loads its data, so moving between sections feels instant. */
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Зареждане">
      <div className="h-9 w-56 animate-pulse rounded-2xl bg-sand" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-card bg-sand" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-card bg-sand" />
    </div>
  );
}
