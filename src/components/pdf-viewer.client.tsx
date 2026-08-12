import { PDFViewer } from "@embedpdf/react-pdf-viewer";

export default function ClientPdfViewer({ src }: { src: string }) {
  return (
    <PDFViewer
      config={{
        src,
        theme: { preference: "light" },
      }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
