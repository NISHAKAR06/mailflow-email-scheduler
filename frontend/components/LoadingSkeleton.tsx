export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      {/* Header skeleton */}
      <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-surface-border bg-primary-50">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-3 rounded" style={{ width: `${40 + i * 10}%` }} />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-4 gap-4 px-4 py-3.5 border-b border-surface-border"
        >
          <div className="skeleton h-3 rounded" style={{ width: '70%' }} />
          <div className="skeleton h-3 rounded" style={{ width: '85%' }} />
          <div className="skeleton h-3 rounded" style={{ width: '55%' }} />
          <div className="skeleton h-3 rounded" style={{ width: '40%' }} />
        </div>
      ))}
    </div>
  );
}
