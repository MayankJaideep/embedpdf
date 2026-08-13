import { useEffect, useState } from "react";

export interface PerfMetrics {
  loadMs: number | null;
  searchMs: number | null;
  searchQuery: string | null;
  searchResults: number | null;
  annotationMs: number | null;
  annotationType: string | null;
  fileSize: number | null;
  pageCount: number | null;
}

export const emptyMetrics: PerfMetrics = {
  loadMs: null,
  searchMs: null,
  searchQuery: null,
  searchResults: null,
  annotationMs: null,
  annotationType: null,
  fileSize: null,
  pageCount: null,
};

function ms(v: number | null) {
  return v == null ? "—" : `${v.toFixed(1)} ms`;
}

function bytes(v: number | null) {
  if (v == null) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(2)} MB`;
}

function useJsMemory() {
  const [used, setUsed] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      setUsed(mem ? mem.usedJSHeapSize : null);
    };
    read();
    const id = window.setInterval(read, 1500);
    return () => window.clearInterval(id);
  }, []);

  return used;
}

export function PerfPanel({ metrics, onReset }: { metrics: PerfMetrics; onReset: () => void }) {
  const [open, setOpen] = useState(true);
  const memory = useJsMemory();

  const rows: Array<[string, string]> = [
    ["PDF load time", ms(metrics.loadMs)],
    [
      "Search time",
      metrics.searchMs == null
        ? "—"
        : `${ms(metrics.searchMs)}${metrics.searchResults != null ? ` · ${metrics.searchResults} hits` : ""}`,
    ],
    [
      "Annotation response",
      metrics.annotationMs == null
        ? "—"
        : `${ms(metrics.annotationMs)}${metrics.annotationType ? ` · ${metrics.annotationType}` : ""}`,
    ],
    ["PDF file size", bytes(metrics.fileSize)],
    ["Page count", metrics.pageCount == null ? "—" : String(metrics.pageCount)],
    ["JS heap used", memory == null ? "not available" : bytes(memory)],
  ];

  return (
    <aside className="pointer-events-auto absolute bottom-4 right-4 z-50 w-72 overflow-hidden rounded-xl border border-border bg-card/95 text-card-foreground shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          Performance {open ? "▾" : "▸"}
        </button>
        <button
          onClick={onReset}
          className="rounded-md border border-input px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
        >
          Reset
        </button>
      </div>

      {open && (
        <table className="w-full text-xs">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted-foreground">
                  {label}
                </th>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  );
}
