import { useState, useEffect, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ImageConfig } from "./NamePlacementEditor";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

// Set up PDF.js worker - use local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface NamePreviewPageProps {
  names: string[];
  pdfs: string[];
  imageConfigs: ImageConfig[];
  onNext: () => void;
  onBack: () => void;
}

export function NamePreviewPage({ names, pdfs, imageConfigs, onNext, onBack }: NamePreviewPageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [renderMetrics, setRenderMetrics] = useState<{ rw: number; rh: number; offsetX: number; offsetY: number } | null>(null);

  const allConfigs = imageConfigs;
  const currentName = names[0];

  // First render PDFs to images
  useEffect(() => {
    const renderPdfs = async () => {
      setIsLoading(true);
      const renderedImages: string[] = [];
      
      for (const pdfDataUrl of pdfs) {
        try {
          const base64String = pdfDataUrl.includes(",") ? pdfDataUrl.split(",")[1] : pdfDataUrl;
          const pdfData = atob(base64String);
          const pdfArray = new Uint8Array(pdfData.length);
          for (let i = 0; i < pdfData.length; i++) {
            pdfArray[i] = pdfData.charCodeAt(i);
          }

          const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
          const pageCount = pdf.numPages;
          
          // Render all pages
          for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 4 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const context = canvas.getContext("2d");
            if (context) {
              await page.render({
                canvasContext: context,
                viewport: viewport,
                canvas: canvas,
              } as any).promise;
              
              renderedImages.push(canvas.toDataURL("image/png"));
            }
          }
        } catch (error) {
          console.error("Error rendering PDF:", error);
          renderedImages.push("");
        }
      }
      
      setPdfImages(renderedImages);
      setIsLoading(false);
    };
    
    renderPdfs();
  }, [pdfs]);

  useEffect(() => {
    if (pdfImages.length > 0 && !isLoading) {
      generatePreviews();
    }
  }, [pdfImages, isLoading]);

  const computeRenderMetrics = () => {
    const container = containerRef.current;
    const imgEl = imgRef.current;
    if (!container || !imgEl) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = imgEl.naturalWidth || imgEl.width;
    const ih = imgEl.naturalHeight || imgEl.height;
    if (!cw || !ch || !iw || !ih) return;
    const imgAR = iw / ih;
    const contAR = cw / ch;
    let rw: number, rh: number, offsetX = 0, offsetY = 0;
    if (imgAR > contAR) {
      rw = cw;
      rh = cw / imgAR;
      offsetY = (ch - rh) / 2;
    } else {
      rh = ch;
      rw = ch * imgAR;
      offsetX = (cw - rw) / 2;
    }
    setRenderMetrics({ rw, rh, offsetX, offsetY });
  };

  const generatePreviews = async () => {
    const previews: string[] = [];

    // Generate preview for first name only
    const name = names[0];
    // Match NamePlacementEditor visual sizing: its preview container uses ~850px height
    const previewTargetHeight = 850;
    
    for (const config of allConfigs) {
      const canvas = document.createElement('canvas');
      const img = new Image();
      
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = pdfImages[config.imageIndex];
      });

      // Render preview at fixed visual height to match editor
      const targetHeight = previewTargetHeight;
      const targetWidth = Math.round((img.width / img.height) * targetHeight);
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d')!;
      
      // Draw image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Add text if enabled or if extraText exists
      if (config.enabled || config.extraText) {
        // Create SVG for text
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', targetWidth.toString());
        svg.setAttribute('height', targetHeight.toString());

        // Add main text only if enabled
        if (config.enabled) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', ((config.x / 100) * targetWidth).toString());
          text.setAttribute('y', ((config.y / 100) * targetHeight).toString());
          // Use the exact font size from editor
          text.setAttribute('font-size', `${config.fontSize}px`);
          text.setAttribute('font-family', config.fontFamily);
          text.setAttribute('fill', config.fontColor);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('dominant-baseline', 'middle');
          text.setAttribute('font-weight', config.bold ? 'bold' : 'normal');
          text.setAttribute('font-style', config.italic ? 'italic' : 'normal');
          text.setAttribute('text-decoration', config.underline ? 'underline' : 'none');
          text.textContent = config.sampleText || name;

          svg.appendChild(text);
        }

        // Add extra text if present
        if (config.extraText) {
          const extraText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          extraText.setAttribute('x', (((config.extraX ?? 50) / 100) * targetWidth).toString());
          extraText.setAttribute('y', (((config.extraY ?? 60) / 100) * targetHeight).toString());
          // Use the exact font size from editor
          extraText.setAttribute('font-size', `${config.fontSize}px`);
          extraText.setAttribute('font-family', config.fontFamily);
          extraText.setAttribute('fill', config.fontColor);
          extraText.setAttribute('text-anchor', 'middle');
          extraText.setAttribute('dominant-baseline', 'middle');
          extraText.setAttribute('font-weight', config.bold ? 'bold' : 'normal');
          extraText.setAttribute('font-style', config.italic ? 'italic' : 'normal');
          extraText.setAttribute('text-decoration', config.underline ? 'underline' : 'none');
          extraText.textContent = config.extraText;

          svg.appendChild(extraText);
        }

        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const svgImg = new Image();
        await new Promise((resolve) => {
          svgImg.onload = resolve;
          svgImg.src = svgUrl;
        });

        ctx.drawImage(svgImg, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(svgUrl);
      }

      previews.push(canvas.toDataURL('image/png'));
    }

    setPreviewImages(previews);
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < allConfigs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="outline" onClick={onBack}>
            ← Back to Edit
          </Button>
        </div>

        <h1 className="text-3xl mb-4">Preview - How Names Will Appear</h1>
        <p className="text-gray-600 mb-8">
          This shows how "{currentName}" will appear on your cards. All names will be positioned the same way.
        </p>



        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous Page
              </Button>

              <span className="text-sm font-medium">
                Page {currentIndex + 1} of {allConfigs.length}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                disabled={currentIndex === allConfigs.length - 1}
              >
                Next Page
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {(() => {
              const cfg = allConfigs[currentIndex];
              const imgSrc = pdfImages[cfg.imageIndex];
              
              if (isLoading) {
                return (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p>Loading preview...</p>
                    </div>
                  </div>
                );
              }
              
              return (
                <div className="bg-white border-2 rounded-lg p-4 flex justify-center">
                  <div
                    className="relative w-full"
                    style={{ maxHeight: 850 }}
                  >
                    <div
                      className="relative bg-white rounded-lg overflow-hidden"
                      style={{ width: "100%", height: 850 }}
                      ref={containerRef}
                    >
                      <img
                        src={imgSrc}
                        alt={`Preview ${currentIndex + 1}`}
                        className="w-full h-full object-contain"
                        ref={imgRef}
                        onLoad={computeRenderMetrics}
                      />
                      {renderMetrics && (
                        <>
                          {cfg.enabled && (
                            <>
                              <svg
                                className="absolute"
                                style={{ left: renderMetrics.offsetX, top: renderMetrics.offsetY, width: renderMetrics.rw, height: renderMetrics.rh }}
                              >
                                <text
                                  x={`${cfg.x}%`}
                                  y={`${cfg.y}%`}
                                  fontSize={`${cfg.fontSize}px`}
                                  fontFamily={cfg.fontFamily}
                                  fill={cfg.fontColor}
                                  fontWeight={cfg.bold ? "bold" : "normal"}
                                  fontStyle={cfg.italic ? "italic" : "normal"}
                                  textDecoration={cfg.underline ? "underline" : "none"}
                                  textAnchor="start"
                                  dominantBaseline="middle"
                                  direction="ltr"
                                  style={{ textRendering: "geometricPrecision" }}
                                >
                                  {cfg.sampleText || currentName}
                                </text>
                              </svg>
                            </>
                          )}
                          {cfg.extraText && (
                            <>
                              <svg
                                className="absolute"
                                style={{ left: renderMetrics.offsetX, top: renderMetrics.offsetY, width: renderMetrics.rw, height: renderMetrics.rh }}
                              >
                                <text
                                  x={`${cfg.extraX ?? 50}%`}
                                  y={`${cfg.extraY ?? 60}%`}
                                  fontSize={`${cfg.fontSize}px`}
                                  fontFamily={cfg.fontFamily}
                                  fill={cfg.fontColor}
                                  fontWeight={cfg.bold ? "bold" : "normal"}
                                  fontStyle={cfg.italic ? "italic" : "normal"}
                                  textDecoration={cfg.underline ? "underline" : "none"}
                                  textAnchor="start"
                                  dominantBaseline="middle"
                                  direction="ltr"
                                  style={{ textRendering: "geometricPrecision" }}
                                >
                                  {cfg.extraText}
                                </text>
                              </svg>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-900">
            ✓ This preview shows exactly how your {names.length} card{names.length > 1 ? 's' : ''} will look in the PDF
          </p>
          <p className="text-sm text-blue-900 mt-1">
            ✓ The font size and position you set will be the same in the output PDF
          </p>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back - Change Settings
          </Button>
          <Button size="lg" onClick={onNext}>
            Looks Good - Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
