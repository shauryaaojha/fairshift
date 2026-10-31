/** Shown while a worker screen loads on a slow connection. No text, so no language to guess. */
export function ScreenSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-4" aria-busy="true">
      <div className="h-12 w-2/3 animate-pulse rounded-[10px] bg-card motion-reduce:animate-none" />
      <div className="h-28 animate-pulse rounded-[10px] bg-card motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-[10px] bg-card motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-[10px] bg-card motion-reduce:animate-none" />
      </div>
    </div>
  );
}
