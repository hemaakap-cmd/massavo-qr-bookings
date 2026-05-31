import { useCallback, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface PdfGenerationOptions {
  filename?: string;
  format?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  scale?: number;
}

/**
 * Hook for generating PDFs from DOM elements.
 *
 * jspdf (~70KB gz) and html2canvas (~50KB gz) are loaded on demand via
 * dynamic import. They land in the "pdf-vendor" chunk (see vite.config.ts)
 * and don't ship on the landing/booking flows. The chunk is only fetched
 * the first time a user clicks Print / Download report.
 */
export function usePdfGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const isMobile = useIsMobile();

  const generatePdf = useCallback(async (
    element: HTMLElement | null,
    options: PdfGenerationOptions = {}
  ): Promise<boolean> => {
    if (!element) {
      console.error("No element provided for PDF generation");
      return false;
    }

    const {
      filename = "document.pdf",
      format = "a4",
      orientation = "portrait",
      scale = isMobile ? 1.5 : 2, // Lower scale on mobile for performance
    } = options;

    setIsGenerating(true);

    try {
      // Lazy-load the PDF stack on first use.
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      // Render DOM to canvas
      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        // Ensure fonts are loaded
        onclone: (clonedDoc) => {
          // Make sure the cloned element is visible
          const clonedElement = clonedDoc.body.querySelector(".print-content");
          if (clonedElement instanceof HTMLElement) {
            clonedElement.style.visibility = "visible";
            clonedElement.style.position = "relative";
          }
        },
      });

      // Calculate dimensions based on paper format
      const pageWidth = format === "a4" ? 210 : 215.9; // mm
      const pageHeight = format === "a4" ? 297 : 279.4; // mm
      
      // Swap for landscape
      const pdfWidth = orientation === "landscape" ? pageHeight : pageWidth;
      const pdfHeight = orientation === "landscape" ? pageWidth : pageHeight;
      
      // Calculate image dimensions to fit page with margins
      const margin = 10; // mm
      const contentWidth = pdfWidth - (margin * 2);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Create PDF
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format,
      });

      const imgData = canvas.toDataURL("image/png");
      
      // Handle multi-page documents
      let heightLeft = imgHeight;
      let position = margin;
      const contentHeight = pdfHeight - (margin * 2);

      // Add first page
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgHeight - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }

      // Save the PDF
      pdf.save(filename);
      
      return true;
    } catch (error) {
      console.error("PDF generation failed:", error);
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [isMobile]);

  return { generatePdf, isGenerating };
}
