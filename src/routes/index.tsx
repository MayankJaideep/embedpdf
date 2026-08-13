import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PerfPanel, emptyMetrics, type PerfMetrics } from "@/components/perf-panel";

const ClientPdfViewer = lazy(() => import("@/components/pdf-viewer.client"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EmbedPDF POC — Upload, View, Search & Annotate PDFs" },
      {
        name: "description",
        content:
          "A minimal frontend-only proof of concept: upload a PDF from your computer, view it, search its text and add annotations with EmbedPDF.",
      },
      { property: "og:title", content: "EmbedPDF POC — Upload, View, Search & Annotate PDFs" },
      {
        property: "og:description",
        content:
          "Upload a PDF locally and view, search and annotate it in the browser with EmbedPDF. No backend, no storage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [loadStart, setLoadStart] = useState(0);
  const [metrics, setMetrics] = useState<PerfMetrics>(emptyMetrics);
  const inputRef = useRef<HTMLInputElement>(null);

  const patchMetrics = useCallback(
    (patch: Partial<PerfMetrics>) => setMetrics((m) => ({ ...m, ...patch })),
    [],
  );

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const openFile = useCallback((file?: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return;
    setMetrics({ ...emptyMetrics, fileSize: file.size });
    setLoadStart(performance.now());
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFileName(file.name);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">EmbedPDF POC</h1>
          <p className="text-xs text-muted-foreground">
            {fileName ? fileName : "Upload → View → Search → Annotate"}
          </p>
        </div>
        {fileUrl && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Open another PDF
            </button>
          </div>
        )}
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => openFile(e.target.files?.[0])}
      />

      <main className="min-h-0 flex-1">
        {!fileUrl ? (
          <div className="flex h-full items-center justify-center p-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                openFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex w-full max-w-xl cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-14 text-center transition-colors ${
                dragging ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
              }`}
            >
              <p className="text-lg font-medium">Drop a PDF here</p>
              <p className="text-sm text-muted-foreground">
                or click to choose a .pdf file from your computer
              </p>
              <p className="text-xs text-muted-foreground">
                Files stay in your browser — nothing is uploaded.
              </p>
            </div>
          </div>
        ) : (
          <ClientOnly
            fallback={<p className="p-6 text-sm text-muted-foreground">Loading viewer…</p>}
          >
            <Suspense
              fallback={<p className="p-6 text-sm text-muted-foreground">Loading viewer…</p>}
            >
              <ClientPdfViewer key={fileUrl} src={fileUrl} />
            </Suspense>
          </ClientOnly>
        )}
      </main>
    </div>
  );
}
