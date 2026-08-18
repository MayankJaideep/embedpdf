import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LIBRARY_LABEL,
  downloadCsv,
  fmtBytes,
  fmtMs,
  loadRuns,
  saveRuns,
  type BenchRun,
  type LibraryId,
} from "@/lib/bench";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EmbedPDF vs PSPDFKit — Fair PDF Benchmark POC" },
      {
        name: "description",
        content:
          "Upload one PDF and benchmark EmbedPDF against PSPDFKit/Nutrient sequentially: load, first-page render, search, annotation response, heap usage. CSV export included.",
      },
      { property: "og:title", content: "EmbedPDF vs PSPDFKit — Fair PDF Benchmark POC" },
      {
        property: "og:description",
        content:
          "Frontend-only benchmark comparing EmbedPDF and PSPDFKit/Nutrient on the same PDF with real SDK events.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Benchmark,
});

const METRIC_ROWS = [
  ["PDF load time", (r: BenchRun) => fmtMs(r.metrics.loadMs)],
  ["First-page render", (r: BenchRun) => fmtMs(r.metrics.firstPageRenderMs)],
  [
    "Search time",
    (r: BenchRun) =>
      r.metrics.searchMs == null
        ? "—"
        : `${fmtMs(r.metrics.searchMs)} · ${r.metrics.searchResults ?? 0} hits`,
  ],
  ["Annotation response", (r: BenchRun) => fmtMs(r.metrics.annotationMs)],
  ["JS heap used", (r: BenchRun) => fmtBytes(r.metrics.jsHeapBytes)],
  ["Page count", (r: BenchRun) => (r.pageCount == null ? "—" : String(r.pageCount))],
  ["PDF size", (r: BenchRun) => fmtBytes(r.fileSize)],
] as const;

function Benchmark() {
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("common");
  const [warmup, setWarmup] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<BenchRun[]>([]);
  const [latest, setLatest] = useState<Partial<Record<LibraryId, BenchRun>>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRuns(loadRuns());
  }, []);

  const persist = useCallback((run: BenchRun) => {
    setRuns((prev) => {
      const next = [run, ...prev].slice(0, 200);
      saveRuns(next);
      return next;
    });
    setLatest((prev) => ({ ...prev, [run.library]: run }));
  }, []);

  const pickFile = (f?: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return;
    setFile(f);
    setLatest({});
    setStatus("");
  };

  const runBenchmark = async () => {
    const stage = stageRef.current;
    if (!file || !stage || running) return;
    setRunning(true);
    setLatest({});

    const buffer = await file.arrayBuffer();
    const base = {
      timestamp: new Date().toISOString(),
      fileName: file.name,
      fileSize: file.size,
      query,
      userAgent: navigator.userAgent,
    };

    const newUrl = () =>
      URL.createObjectURL(new Blob([buffer.slice(0)], { type: "application/pdf" }));
    const cool = async (ms = 1500) => {
      stage.innerHTML = "";
      await new Promise((r) => setTimeout(r, ms));
    };

    try {
      // ---- Module preload (kept out of every measurement) ----
      setStatus("Preparing SDKs…");
      const { runEmbedPdfBenchmark, EMBEDPDF_VERSION } = await import("@/lib/bench-embedpdf");
      const { runNutrientBenchmark } = await import("@/lib/bench-nutrient");

      // ---- Warm-up pass: identical for both SDKs, results discarded ----
      if (warmup) {
        setStatus("Warm-up: EmbedPDF…");
        const wUrl = newUrl();
        await runEmbedPdfBenchmark(stage, wUrl, query);
        URL.revokeObjectURL(wUrl);
        await cool();
        setStatus("Warm-up: PSPDFKit / Nutrient…");
        await runNutrientBenchmark(stage, buffer, query);
        await cool();
      }

      // ---- Pass 1: EmbedPDF ----
      setStatus("Running EmbedPDF…");
      const url = newUrl();
      const embed = await runEmbedPdfBenchmark(stage, url, query);
      URL.revokeObjectURL(url);
      persist({
        ...base,
        id: crypto.randomUUID(),
        library: "embedpdf",
        libraryVersion: EMBEDPDF_VERSION,
        pageCount: embed.pageCount,
        metrics: embed.metrics,
      });

      // ---- Full reset between libraries ----
      setStatus("Resetting viewer…");
      await cool();

      // ---- Pass 2: PSPDFKit / Nutrient ----
      setStatus("Running PSPDFKit / Nutrient…");
      const nutrient = await runNutrientBenchmark(stage, buffer, query);
      persist({
        ...base,
        id: crypto.randomUUID(),
        library: "pspdfkit",
        libraryVersion: nutrient.version,
        pageCount: nutrient.pageCount,
        metrics: nutrient.metrics,
      });

      stage.innerHTML = "";
      setStatus("Benchmark complete.");
    } catch (err) {
      setStatus(`Benchmark failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const embed = latest.embedpdf;
  const nutrient = latest.pspdfkit;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            EmbedPDF vs PSPDFKit — Fair Benchmark
          </h1>
          <p className="text-xs text-muted-foreground">
            Same PDF, same browser, sequential runs, real SDK events only.
          </p>
        </div>
        <Link
          to="/viewer"
          className="rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          Open viewer
        </Link>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-5">
        <section className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              {file ? "Choose another PDF" : "Upload PDF"}
            </button>
            <span className="text-sm text-muted-foreground">
              {file ? `${file.name} · ${fmtBytes(file.size)}` : "No file selected"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-muted-foreground" htmlFor="query">
              Search term
            </label>
            <input
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-40 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={warmup}
                onChange={(e) => setWarmup(e.target.checked)}
              />
              Warm-up pass (fair caches)
            </label>
            <button
              onClick={runBenchmark}
              disabled={!file || running || !query.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {running ? "Running…" : "Run Fair Benchmark"}
            </button>
            {status && <span className="text-sm text-muted-foreground">{status}</span>}
          </div>
        </section>

        <section className="rounded-xl border border-border">
          <div className="border-b border-border px-4 py-2 text-sm font-semibold">Comparison</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-left font-normal">Metric</th>
                <th className="px-4 py-2 text-right font-normal">{LIBRARY_LABEL.embedpdf}</th>
                <th className="px-4 py-2 text-right font-normal">{LIBRARY_LABEL.pspdfkit}</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map(([label, render]) => (
                <tr key={label} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-1.5 text-muted-foreground">{label}</td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums">
                    {embed ? render(embed) : "—"}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums">
                    {nutrient ? render(nutrient) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(embed?.metrics.error || nutrient?.metrics.error) && (
            <p className="border-t border-border px-4 py-2 text-xs text-destructive">
              {embed?.metrics.error ? `EmbedPDF: ${embed.metrics.error}. ` : ""}
              {nutrient?.metrics.error ? `PSPDFKit: ${nutrient.metrics.error}.` : ""}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <span className="text-sm font-semibold">Saved runs ({runs.length})</span>
            <div className="flex gap-2">
              <button
                onClick={() => downloadCsv(runs)}
                disabled={runs.length === 0}
                className="rounded-md border border-input px-2 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                Export CSV
              </button>
              <button
                onClick={() => {
                  setRuns([]);
                  saveRuns([]);
                  setLatest({});
                }}
                disabled={runs.length === 0}
                className="rounded-md border border-input px-2 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-1.5 text-left font-normal">Time</th>
                  <th className="px-4 py-1.5 text-left font-normal">Library</th>
                  <th className="px-4 py-1.5 text-right font-normal">Load</th>
                  <th className="px-4 py-1.5 text-right font-normal">Render</th>
                  <th className="px-4 py-1.5 text-right font-normal">Search</th>
                  <th className="px-4 py-1.5 text-right font-normal">Annot.</th>
                  <th className="px-4 py-1.5 text-right font-normal">Heap</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-1.5">{new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-1.5 font-sans">{LIBRARY_LABEL[r.library]}</td>
                    <td className="px-4 py-1.5 text-right">{fmtMs(r.metrics.loadMs)}</td>
                    <td className="px-4 py-1.5 text-right">
                      {fmtMs(r.metrics.firstPageRenderMs)}
                    </td>
                    <td className="px-4 py-1.5 text-right">{fmtMs(r.metrics.searchMs)}</td>
                    <td className="px-4 py-1.5 text-right">{fmtMs(r.metrics.annotationMs)}</td>
                    <td className="px-4 py-1.5 text-right">{fmtBytes(r.metrics.jsHeapBytes)}</td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-muted-foreground" colSpan={7}>
                      No runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs text-muted-foreground">
            Benchmark stage — each SDK renders here one at a time and is fully unloaded before the
            next one runs.
          </p>
          <div ref={stageRef} className="h-[520px] w-full rounded-xl border border-border" />
        </section>
      </main>
    </div>
  );
}
