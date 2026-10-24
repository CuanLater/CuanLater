'use client';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-[420px] space-y-3 rounded-t-sheet bg-raised p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="size-11 text-xl">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
