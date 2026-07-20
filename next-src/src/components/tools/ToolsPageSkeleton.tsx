export function ToolsPageSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6">
      <div className="h-9 w-48 bg-[var(--surface-subtle)]" />
      <div className="mt-6 h-14 border border-[var(--line)] bg-[var(--surface)]" />
      <div className="mt-8 space-y-2" role="status" aria-label="正在加载工具目录">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[88px] border-b border-[var(--line)] bg-[var(--surface)]" />)}
      </div>
    </main>
  );
}
