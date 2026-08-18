export type LibraryId = "embedpdf" | "pspdfkit";

export interface BenchMetrics {
  loadMs: number | null;
  firstPageRenderMs: number | null;
  searchMs: number | null;
  searchResults: number | null;
  annotationMs: number | null;
  jsHeapBytes: number | null;
  error?: string;
}

export interface BenchRun {
  id: string;
  timestamp: string;
  fileName: string;
  fileSize: number;
  pageCount: number | null;
  query: string;
  library: LibraryId;
  libraryVersion: string;
  userAgent: string;
  metrics: BenchMetrics;
}

export const LIBRARY_LABEL: Record<LibraryId, string> = {
  embedpdf: "EmbedPDF",
  pspdfkit: "PSPDFKit / Nutrient",
};

const STORAGE_KEY = "pdf-bench-runs-v1";

export function loadRuns(): BenchRun[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BenchRun[]) : [];
  } catch {
    return [];
  }
}

export function saveRuns(runs: BenchRun[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

export function readHeap(): number | null {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? mem.usedJSHeapSize : null;
}

export function fmtMs(v: number | null | undefined) {
  return v == null ? "—" : `${v.toFixed(1)} ms`;
}

export function fmtBytes(v: number | null | undefined) {
  if (v == null) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(2)} MB`;
}

const CSV_COLUMNS = [
  "timestamp",
  "library",
  "libraryVersion",
  "fileName",
  "fileSizeBytes",
  "pageCount",
  "query",
  "loadMs",
  "firstPageRenderMs",
  "searchMs",
  "searchResults",
  "annotationMs",
  "jsHeapBytes",
  "error",
  "userAgent",
] as const;

export function runsToCsv(runs: BenchRun[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of runs) {
    lines.push(
      [
        r.timestamp,
        LIBRARY_LABEL[r.library],
        r.libraryVersion,
        r.fileName,
        r.fileSize,
        r.pageCount ?? "",
        r.query,
        r.metrics.loadMs?.toFixed(2) ?? "",
        r.metrics.firstPageRenderMs?.toFixed(2) ?? "",
        r.metrics.searchMs?.toFixed(2) ?? "",
        r.metrics.searchResults ?? "",
        r.metrics.annotationMs?.toFixed(2) ?? "",
        r.metrics.jsHeapBytes ?? "",
        r.metrics.error ?? "",
        r.userAgent,
      ]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(runs: BenchRun[], fileName = "pdf-benchmark.csv") {
  const blob = new Blob([runsToCsv(runs)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Collects canvases across nested shadow roots (EmbedPDF renders inside a web component). */
function deepCanvases(root: ParentNode): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  const walk = (node: ParentNode) => {
    out.push(...(Array.from(node.querySelectorAll("canvas")) as HTMLCanvasElement[]));
    for (const el of Array.from(node.querySelectorAll("*"))) {
      const sr = (el as HTMLElement).shadowRoot;
      if (sr) walk(sr);
    }
  };
  walk(root);
  return out;
}

/** Waits until the first real page canvas exists and has painted pixels. */
export function waitForFirstCanvas(container: HTMLElement, timeoutMs = 60000): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      observer.disconnect();
      window.clearInterval(poll);
      if (ok) resolve(performance.now());
      else reject(new Error("first page render timeout"));
    };
    const check = () => {
      const canvases = deepCanvases(container);
      const painted = canvases.find(
        (c) => c.width > 1 && c.height > 1 && c.getBoundingClientRect().width > 1,
      );
      if (painted) requestAnimationFrame(() => finish(true));
      else if (performance.now() - start > timeoutMs) finish(false);
    };
    const observer = new MutationObserver(check);
    observer.observe(container, { childList: true, subtree: true, attributes: true });
    const poll = window.setInterval(check, 30);
    check();
  });
}
