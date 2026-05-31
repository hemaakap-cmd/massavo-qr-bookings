import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface PrintPortalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onAfterPrint?: () => void;
}

/**
 * PrintPortal - Mobile-compatible print solution
 * 
 * Uses a direct DOM overlay approach that works reliably on:
 * - Desktop browsers (Chrome, Firefox, Safari, Edge)
 * - Mobile browsers (iOS Safari, Chrome for Android)
 * 
 * Key features:
 * - Creates a .print-overlay div directly on body
 * - Uses CSS @media print rules for visibility control
 * - Avoids iframe timing issues on mobile
 * - Ensures content is fully rendered before print
 */
const PrintPortal = ({ children, isOpen, onAfterPrint }: PrintPortalProps) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const printTriggeredRef = useRef(false);
  const cleanupTimeoutRef = useRef<number | null>(null);

  // Create overlay container when opening
  useEffect(() => {
    if (isOpen && !container) {
      // Clear any pending cleanup
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }

      // Create the print overlay element
      const el = document.createElement("div");
      el.className = "print-overlay";
      el.style.cssText = `
        display: flex;
        flex-direction: column;
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: white;
        overflow: auto;
        visibility: visible;
      `;
      
      // Append directly to body for maximum print compatibility
      document.body.appendChild(el);
      document.body.classList.add("printing-active");
      
      setContainer(el);
      printTriggeredRef.current = false;
      setIsReady(false);
    }
    
    return () => {
      // Cleanup happens in onAfterPrint or unmount effect
    };
  }, [isOpen]);

  // Handle closing
  useEffect(() => {
    if (!isOpen && container) {
      cleanup();
    }
  }, [isOpen]);

  const cleanup = useCallback(() => {
    document.body.classList.remove("printing-active");
    
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
    
    setContainer(null);
    setIsReady(false);
  }, [container]);

  // Mark as ready after content has fully rendered
  useEffect(() => {
    if (container && isOpen && !isReady) {
      // Use multiple animation frames to ensure full paint
      let frameCount = 0;
      const waitForPaint = () => {
        frameCount++;
        if (frameCount >= 3) {
          // Additional delay for images and complex content
          setTimeout(() => {
            setIsReady(true);
          }, 100);
        } else {
          requestAnimationFrame(waitForPaint);
        }
      };
      requestAnimationFrame(waitForPaint);
    }
  }, [container, isOpen, isReady]);

  // Trigger print when ready
  useEffect(() => {
    if (isReady && container && !printTriggeredRef.current) {
      printTriggeredRef.current = true;
      
      // Give mobile browsers extra time to render
      const printDelay = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 300 : 150;
      
      const printTimeout = setTimeout(() => {
        // Focus the window to ensure print dialog appears
        window.focus();
        
        // Trigger print
        window.print();
        
        // Clean up after print dialog closes
        // Use a longer delay for mobile
        cleanupTimeoutRef.current = window.setTimeout(() => {
          onAfterPrint?.();
        }, 100);
      }, printDelay);

      return () => clearTimeout(printTimeout);
    }
  }, [isReady, container, onAfterPrint]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      document.body.classList.remove("printing-active");
      const existingOverlay = document.querySelector(".print-overlay");
      if (existingOverlay && document.body.contains(existingOverlay)) {
        document.body.removeChild(existingOverlay);
      }
    };
  }, []);

  // Don't render until container exists
  if (!isOpen || !container) {
    return null;
  }

  return createPortal(
    <div className="print-document bg-white min-h-screen">
      {children}
    </div>,
    container
  );
};

export default PrintPortal;
