import { useRef, useEffect, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { usePdfGeneration } from "@/hooks/usePdfGeneration";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Printer } from "lucide-react";
interface PrintableContainerProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  filename?: string;
  title?: string;
}

/**
 * PrintableContainer - Universal print/PDF solution
 * 
 * On mobile: Generates PDF using jsPDF + html2canvas (reliable)
 * On desktop: Offers both PDF download and native print
 * 
 * This approach solves the blank page issue on mobile browsers
 * by avoiding the browser's print engine entirely on mobile.
 */
const PrintableContainer = ({ 
  children, 
  isOpen, 
  onClose, 
  filename = "document.pdf",
  title = "Document"
}: PrintableContainerProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const { generatePdf, isGenerating } = usePdfGeneration();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);

  // Show content when opened
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    } else {
      setIsVisible(false);
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleDownloadPdf = useCallback(async () => {
    if (!contentRef.current) return;
    
    const success = await generatePdf(contentRef.current, { filename });
    if (success) {
      onClose();
    }
  }, [generatePdf, filename, onClose]);

  const handlePrint = useCallback(() => {
    // For desktop, use native print but with the isolated content
    const printContent = contentRef.current;
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      // Fallback to PDF if popup blocked
      handleDownloadPdf();
      return;
    }

    // Get the HTML content and sanitize it to prevent XSS attacks
    // DOMPurify removes any malicious scripts/event handlers while preserving safe HTML
    const rawHtmlContent = printContent.innerHTML;
    const htmlContent = DOMPurify.sanitize(rawHtmlContent, {
      ALLOWED_TAGS: [
        'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'ul', 'ol', 'li', 'br', 'hr', 'strong', 'b', 'em', 'i',
        'img', 'svg', 'path', 'g', 'rect', 'circle', 'line', 'polyline', 'polygon',
        'header', 'footer', 'section', 'article', 'aside', 'main', 'nav'
      ],
      ALLOWED_ATTR: [
        'class', 'style', 'id', 'src', 'alt', 'width', 'height',
        'colspan', 'rowspan', 'align', 'valign',
        'd', 'fill', 'stroke', 'stroke-width', 'viewBox', 'xmlns',
        'transform', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry'
      ],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur']
    });
    
    // Write the print document
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Inter', sans-serif;
              background: white;
            }
            @media print {
              @page { size: A4; margin: 10mm 12mm; }
              body { background: white !important; }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
        onClose();
      };
    };
  }, [title, handleDownloadPdf, onClose]);

  // Auto-trigger PDF on mobile when opened
  useEffect(() => {
    if (isOpen && isMobile && isVisible) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        handleDownloadPdf();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMobile, isVisible, handleDownloadPdf]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-foreground/50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h2 className="font-display font-semibold text-lg">{title}</h2>
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <Button disabled variant="outline" size="sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
                {!isMobile && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>

        {/* Scrollable preview area */}
        <div className="flex-1 overflow-auto bg-muted p-4">
          <div 
            ref={contentRef}
            className="print-content bg-background shadow-lg mx-auto"
            style={{ 
              maxWidth: "210mm", // A4 width
              minHeight: "297mm", // A4 height
            }}
          >
            {children}
          </div>
        </div>

        {/* Mobile loading state */}
        {isGenerating && isMobile && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-foreground">Generating PDF...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintableContainer;
