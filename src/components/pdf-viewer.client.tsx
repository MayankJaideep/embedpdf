import {
  PDFViewer,
  type PluginRegistry,
  type AnnotationPlugin,
  type SearchPlugin,
  type DocumentManagerPlugin,
} from "@embedpdf/react-pdf-viewer";
import type { PerfMetrics } from "./perf-panel";

type Patch = (patch: Partial<PerfMetrics>) => void;

export default function ClientPdfViewer({
  src,
  loadStart,
  onMetrics,
}: {
  src: string;
  loadStart: number;
  onMetrics: Patch;
}) {
  const handleReady = (registry: PluginRegistry) => {
    const docs = registry
      .getPlugin<DocumentManagerPlugin>("document-manager")
      ?.provides();
    const search = registry.getPlugin<SearchPlugin>("search")?.provides();
    const annotations = registry.getPlugin<AnnotationPlugin>("annotation")?.provides();

    docs?.onDocumentOpened((state) => {
      const doc = state?.document ?? docs.getActiveDocument();
      onMetrics({
        loadMs: performance.now() - loadStart,
        pageCount: doc?.pageCount ?? null,
      });
    });

    let searchStart: number | null = null;
    search?.onSearchStart(() => {
      searchStart = performance.now();
    });
    search?.onSearchResult((event) => {
      if (searchStart == null) return;
      const results = (event as unknown as { results?: unknown[] }).results;
      onMetrics({
        searchMs: performance.now() - searchStart,
        searchResults: Array.isArray(results) ? results.length : null,
      });
      searchStart = null;
    });

    // Annotation response time: from the user's last pointer/key interaction
    // inside the viewer until the SDK emits the annotation event.
    let lastInteraction: number | null = null;
    const mark = () => {
      lastInteraction = performance.now();
    };
    window.addEventListener("pointerdown", mark, true);
    window.addEventListener("pointerup", mark, true);
    window.addEventListener("keydown", mark, true);

    annotations?.onAnnotationEvent((event) => {
      if (lastInteraction == null) return;
      onMetrics({
        annotationMs: performance.now() - lastInteraction,
        annotationType: event.type,
      });
    });
  };

  return (
    <PDFViewer
      config={{
        src,
        theme: { preference: "light" },
      }}
      style={{ width: "100%", height: "100%" }}
      onReady={handleReady}
    />
  );
}
