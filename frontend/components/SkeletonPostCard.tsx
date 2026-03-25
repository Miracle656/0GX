export function SkeletonPostCard() {
  return (
    <div className="glass-card p-4 sm:p-6 flex flex-col gap-4 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-surface-2 border border-border" />
          <div className="flex flex-col gap-2 relative top-0.5">
            <div className="flex items-center gap-2">
              <div className="w-24 h-4 bg-surface-2 rounded" />
              <div className="w-16 h-3 bg-surface-2/50 rounded" />
            </div>
            <div className="w-32 h-3 bg-surface-2/50 rounded" />
          </div>
        </div>
        <div className="w-8 h-8 rounded bg-surface-2" />
      </div>

      {/* Content */}
      <div className="pl-0 sm:pl-16 space-y-2 mt-2">
        <div className="w-full h-4 bg-surface-2 rounded" />
        <div className="w-5/6 h-4 bg-surface-2 rounded" />
        <div className="w-4/6 h-4 bg-surface-2 rounded" />
      </div>

      {/* Footer */}
      <div className="pl-0 sm:pl-16 flex items-center gap-6 mt-4">
        <div className="w-16 h-8 bg-surface-2 rounded-lg" />
        <div className="w-16 h-8 bg-surface-2 rounded-lg" />
        <div className="w-20 h-8 bg-surface-2 rounded-lg" />
      </div>
    </div>
  );
}
