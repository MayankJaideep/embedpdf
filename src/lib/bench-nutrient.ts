import { heapDelta, settleHeap, waitForFirstCanvas, type BenchMetrics } from "./bench";

export interface NutrientRunResult {
  metrics: BenchMetrics;
  pageCount: number | null;
  version: string;
}

async function getSdk() {
  const mod = await import("@nutrient-sdk/viewer");
  return (mod as unknown as { default: any }).default ?? (mod as unknown as any);
}

/** Runs the full PSPDFKit/Nutrient measurement sequence inside `container`, then unloads it. */
export async function runNutrientBenchmark(
  container: HTMLElement,
  fileUrl: string,
  query: string,
): Promise<NutrientRunResult> {
  const metrics: BenchMetrics = {
    loadMs: null,
    firstPageRenderMs: null,
    searchMs: null,
    searchResults: null,
    annotationMs: null,
    jsHeapBytes: null,
    jsHeapBaselineBytes: null,
  };
  let pageCount: number | null = null;
  let version = "unknown";
  const NutrientViewer = await getSdk();
  version = NutrientViewer.version ?? "unknown";

  try {
    metrics.jsHeapBaselineBytes = await settleHeap();
    const t0 = performance.now();

    // 1. PDF load time — SDK load() resolution (document ready)
    // Same blob URL source as EmbedPDF so both pay identical fetch cost.
    const instance = await NutrientViewer.load({
      container,
      document: fileUrl,
      baseUrl: `https://cdn.cloud.pspdfkit.com/pspdfkit-web@${version}/`,
    });
    metrics.loadMs = performance.now() - t0;
    pageCount = instance.totalPageCount ?? null;

    // 2. First-page render time — first painted page canvas (non-fatal if not detectable)
    try {
      const renderedAt = await waitForFirstCanvas(container, 20000);
      metrics.firstPageRenderMs = renderedAt - t0;
    } catch {
      metrics.firstPageRenderMs = null;
    }

    // 3. Search time — SDK search API
    const s0 = performance.now();
    const results = await instance.search(query);
    metrics.searchMs = performance.now() - s0;
    metrics.searchResults = results?.size ?? results?.length ?? 0;

    // 4. Annotation response time — create() → annotations.create event
    const rect = new NutrientViewer.Geometry.Rect({
      left: 40,
      top: 40,
      width: 180,
      height: 18,
    });
    const annotation = new NutrientViewer.Annotations.HighlightAnnotation({
      pageIndex: 0,
      rects: NutrientViewer.Immutable.List([rect]),
      boundingBox: rect,
    });
    const annotationDone = new Promise<number>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("annotation timeout")), 30000);
      instance.addEventListener("annotations.create", () => {
        window.clearTimeout(timer);
        resolve(performance.now());
      });
    });
    const a0 = performance.now();
    await instance.create(annotation);
    metrics.annotationMs = (await annotationDone) - a0;

    metrics.jsHeapBytes = heapDelta(metrics.jsHeapBaselineBytes, await settleHeap());
  } catch (err) {
    metrics.error = err instanceof Error ? err.message : String(err);
  } finally {
    try {
      NutrientViewer.unload(container);
    } catch {
      /* already unloaded */
    }
    container.innerHTML = "";
  }

  return { metrics, pageCount, version };
}
