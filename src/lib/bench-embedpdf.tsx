import { createRoot, type Root } from "react-dom/client";
import {
  PDFViewer,
  type PluginRegistry,
  type AnnotationPlugin,
  type SearchPlugin,
  type DocumentManagerPlugin,
} from "@embedpdf/react-pdf-viewer";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { readHeap, waitForFirstCanvas, type BenchMetrics } from "./bench";

export const EMBEDPDF_VERSION = "2.15.0";

export interface EmbedPdfRunResult {
  metrics: BenchMetrics;
  pageCount: number | null;
}

/** Runs the full EmbedPDF measurement sequence inside `container`, then unmounts it. */
export async function runEmbedPdfBenchmark(
  container: HTMLElement,
  fileUrl: string,
  query: string,
): Promise<EmbedPdfRunResult> {
  const metrics: BenchMetrics = {
    loadMs: null,
    firstPageRenderMs: null,
    searchMs: null,
    searchResults: null,
    annotationMs: null,
    jsHeapBytes: null,
  };
  let pageCount: number | null = null;
  let root: Root | null = null;

  try {
    const registryReady = new Promise<PluginRegistry>((resolve) => {
      root = createRoot(container);
      root.render(
        <PDFViewer
          config={{ src: fileUrl, theme: { preference: "light" } }}
          style={{ width: "100%", height: "100%" }}
          onReady={resolve}
        />,
      );
    });

    const t0 = performance.now();
    const registry = await registryReady;

    const docs = registry.getPlugin<DocumentManagerPlugin>("document-manager")?.provides();
    const search = registry.getPlugin<SearchPlugin>("search")?.provides();
    const annotations = registry.getPlugin<AnnotationPlugin>("annotation")?.provides();

    // 1. PDF load time — SDK document-opened event
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("load timeout")), 60000);
      docs?.onDocumentOpened((state) => {
        window.clearTimeout(timer);
        const doc = state?.document ?? docs.getActiveDocument();
        metrics.loadMs = performance.now() - t0;
        pageCount = doc?.pageCount ?? null;
        resolve();
      });
      if (!docs) {
        window.clearTimeout(timer);
        reject(new Error("document-manager plugin unavailable"));
      }
    });

    // 2. First-page render time — first painted page canvas
    const renderedAt = await waitForFirstCanvas(container);
    metrics.firstPageRenderMs = renderedAt - t0;

    // 3. Search time — SDK searchAllPages task
    if (search) {
      const s0 = performance.now();
      const result = await search.searchAllPages(query).toPromise();
      metrics.searchMs = performance.now() - s0;
      metrics.searchResults = result?.results?.length ?? 0;
    }

    // 4. Annotation response time — createAnnotation → SDK annotation event
    if (annotations) {
      const rect = { origin: { x: 40, y: 40 }, size: { width: 180, height: 18 } };
      const annotationDone = new Promise<number>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("annotation timeout")), 30000);
        annotations.onAnnotationEvent(() => {
          window.clearTimeout(timer);
          resolve(performance.now());
        });
      });
      const a0 = performance.now();
      annotations.createAnnotation(0, {
        type: PdfAnnotationSubtype.HIGHLIGHT,
        id: crypto.randomUUID(),
        pageIndex: 0,
        rect,
        segmentRects: [rect],
        opacity: 1,
        strokeColor: "#FFE066",
      });
      metrics.annotationMs = (await annotationDone) - a0;
    }

    metrics.jsHeapBytes = readHeap();
  } catch (err) {
    metrics.error = err instanceof Error ? err.message : String(err);
  } finally {
    root?.unmount();
    container.innerHTML = "";
  }

  return { metrics, pageCount };
}
