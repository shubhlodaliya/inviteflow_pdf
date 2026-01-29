import { useState, useRef, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Slider } from "@/app/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Lock, Move, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

// Set up PDF.js worker - use local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
console.log("📄 PDF.js worker configured:", pdfjsLib.GlobalWorkerOptions.workerSrc);

interface NamePlacementEditorProps {
  pdfs: string[];
  names: string[];
  onNext: (configs: ImageConfig[]) => void;
  onBack: () => void;
}

export interface ImageConfig {
  imageIndex: number;
  x: number;
  y: number;
  fontSize: number;
  designHeight?: number;
  renderHeight?: number;
  renderWidth?: number;
  actualImageWidth?: number;
  actualImageHeight?: number;
  fontFamily: string;
  fontColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  locked: boolean;
  enabled: boolean;
  sampleText?: string;
  order?: number;
  extraText?: string;
  extraX?: number;
  extraY?: number;
}

export function NamePlacementEditor({ pdfs, names, onNext, onBack }: NamePlacementEditorProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [displayOrder, setDisplayOrder] = useState<number[]>([]);
  const [pdfImages, setPdfImages] = useState<string[]>([]); // Store rendered PDF pages as images
  const [isLoadingPdfs, setIsLoadingPdfs] = useState(true); // Add loading state
  const [renderErrors, setRenderErrors] = useState<string[]>([]); // Track rendering errors
  const [imageConfigs, setImageConfigs] = useState<ImageConfig[]>([]);

  // Render PDFs to images on mount
  useEffect(() => {
    const renderPdfPages = async () => {
      try {
        console.log("🔵 Starting PDF rendering...", "PDFs count:", pdfs.length);
        if (!pdfs || pdfs.length === 0) {
          console.log("❌ No PDFs provided");
          setIsLoadingPdfs(false);
          return;
        }
        
        setIsLoadingPdfs(true);
        const renderedImages: string[] = [];
        const errors: string[] = [];
        
        for (let pdfIndex = 0; pdfIndex < pdfs.length; pdfIndex++) {
          const pdfDataUrl = pdfs[pdfIndex];
          try {
            console.log(`🔵 Processing PDF ${pdfIndex + 1}/${pdfs.length}...`);
            
            if (!pdfDataUrl) {
              console.error(`❌ PDF ${pdfIndex + 1} data URL is empty`);
              renderedImages.push("");
              continue;
            }
            
            console.log(`🔵 PDF ${pdfIndex + 1} data URL length:`, pdfDataUrl.length);
            console.log(`🔵 PDF ${pdfIndex + 1} data URL prefix:`, pdfDataUrl.substring(0, 100));
            
            // Extract base64 from data URL
            let base64String = pdfDataUrl;
            if (pdfDataUrl.includes(",")) {
              base64String = pdfDataUrl.split(",")[1];
              console.log(`🔵 Extracted base64 from data URL, length:`, base64String.length);
            } else {
              console.log(`⚠️ No comma found in data URL, treating whole string as base64`);
            }
            
            if (!base64String) {
              console.error(`❌ No base64 data found in PDF ${pdfIndex + 1}`);
              renderedImages.push("");
              continue;
            }
            
            console.log(`🔵 PDF ${pdfIndex + 1}: Decoding base64...`);
            let pdfData: string;
            try {
              pdfData = atob(base64String);
            } catch (decodeError) {
              console.error(`❌ Base64 decode failed for PDF ${pdfIndex + 1}:`, decodeError);
              renderedImages.push("");
              continue;
            }
            
            const pdfArray = new Uint8Array(pdfData.length);
            for (let i = 0; i < pdfData.length; i++) {
              pdfArray[i] = pdfData.charCodeAt(i);
            }
            console.log(`🔵 PDF ${pdfIndex + 1}: Base64 decoded, byte array size:`, pdfArray.length);
            
            // Verify PDF header
            const header = String.fromCharCode(pdfArray[0], pdfArray[1], pdfArray[2], pdfArray[3]);
            console.log(`🔵 PDF ${pdfIndex + 1}: Header (first 4 bytes):`, header);
            if (header !== "%PDF") {
              console.warn(`⚠️ PDF ${pdfIndex + 1}: Invalid PDF header, but continuing anyway`);
            }

            console.log(`🔵 PDF ${pdfIndex + 1}: Loading PDF document...`);
            let pdf;
            try {
              pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
            } catch (loadError) {
              console.error(`❌ Failed to load PDF ${pdfIndex + 1}:`, loadError);
              renderedImages.push("");
              continue;
            }
            
            const pageCount = pdf.numPages;
            console.log(`✅ PDF ${pdfIndex + 1} loaded successfully with ${pageCount} pages`);
            
            // Render all pages, not just the first one
            for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
              console.log(`🔵 PDF ${pdfIndex + 1}: Getting page ${pageNum}/${pageCount}...`);
              let page;
              try {
                page = await pdf.getPage(pageNum);
              } catch (pageError) {
                console.error(`❌ Failed to get page ${pageNum} from PDF ${pdfIndex + 1}:`, pageError);
                renderedImages.push("");
                continue;
              }
              console.log(`✅ PDF ${pdfIndex + 1}: Page ${pageNum} retrieved`);
              
              console.log(`🔵 PDF ${pdfIndex + 1} Page ${pageNum}: Rendering to canvas...`);
              const viewport = page.getViewport({ scale: 4 });
              const canvas = document.createElement("canvas");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              
              const context = canvas.getContext("2d");
              if (!context) {
                console.error(`❌ Could not get 2D context for PDF ${pdfIndex + 1} Page ${pageNum}`);
                renderedImages.push("");
                continue;
              }
              
              try {
                await page.render({
                  canvasContext: context,
                  viewport: viewport,
                  canvas: canvas,
                } as any).promise;
              } catch (renderError) {
                console.error(`❌ Canvas rendering failed for PDF ${pdfIndex + 1} Page ${pageNum}:`, renderError);
                renderedImages.push("");
                continue;
              }
              
              const imageData = canvas.toDataURL("image/png");
              console.log(`✅ PDF ${pdfIndex + 1} Page ${pageNum}: Canvas rendered to PNG, data URL length:`, imageData.length);
              
              // Validate the rendered image is not empty
              if (!imageData || imageData.length < 100) {
                console.error(`❌ PDF ${pdfIndex + 1} Page ${pageNum}: Rendered image is too small or empty`);
                errors.push(`PDF ${pdfIndex + 1} Page ${pageNum}: Rendered image is empty`);
                renderedImages.push("");
              } else {
                renderedImages.push(imageData);
                console.log(`✅ PDF ${pdfIndex + 1} Page ${pageNum}: Successfully added to renderedImages array`);
              }
            }
          } catch (pdfError) {
            const errorMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
            errors.push(`PDF ${pdfIndex + 1}: ${errorMsg}`);
            renderedImages.push("");
          }
        }
        
        console.log(`🔵 Total rendered images: ${renderedImages.length}`);
        console.log(`🔵 Errors: ${errors.length}`);
        setPdfImages(renderedImages);
        setRenderErrors(errors);
        
        // Initialize displayOrder and imageConfigs based on total rendered pages
        const order = renderedImages.map((_, idx) => idx);
        setDisplayOrder(order);
        
        const configs = renderedImages.map((_, index) => ({
          imageIndex: index,
          x: 50,
          y: 35,
          fontSize: 24,
          designHeight: 850,
          renderHeight: 850,
          renderWidth: 850,
          fontFamily: "Noto Sans Gujarati",
          fontColor: "#000000",
          bold: false,
          italic: false,
          underline: false,
          locked: false,
          enabled: false,
          sampleText: names[0] || "Sample Name",
          order: index,
          extraText: undefined,
          extraX: 50,
          extraY: 60,
        }));
        setImageConfigs(configs);
        
        setIsLoadingPdfs(false);
        console.log(`✅ PDF rendering complete. State updated with ${renderedImages.length} images`);
      } catch (error) {
        console.error("❌ Error in renderPdfPages:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        setRenderErrors([`Fatal error: ${errorMsg}`]);
        setIsLoadingPdfs(false);
      }
    };

    renderPdfPages();
  }, [pdfs]);

  const firstName = names[0] || "Sample Name";

  const [isDragging, setIsDragging] = useState(false);
  const [draggingTarget, setDraggingTarget] = useState<'main' | 'extra' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showExtraTextInput, setShowExtraTextInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const extraTextInputRef = useRef<HTMLInputElement>(null);
  const [renderMetrics, setRenderMetrics] = useState<{ rw: number; rh: number; offsetX: number; offsetY: number } | null>(null);

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
      // Image fits by width
      rw = cw;
      rh = cw / imgAR;
      offsetY = (ch - rh) / 2;
    } else {
      // Image fits by height
      rh = ch;
      rw = ch * imgAR;
      offsetX = (cw - rw) / 2;
    }
    setRenderMetrics({ rw, rh, offsetX, offsetY });

    // Persist the rendered height used during placement so PDF can scale font size consistently
    const cfg = imageConfigs[displayOrder[currentImageIndex]];
    if (cfg && (cfg.designHeight !== rh || cfg.renderHeight !== rh || cfg.renderWidth !== rw || cfg.actualImageWidth !== iw || cfg.actualImageHeight !== ih)) {
      updateCurrentConfig({ designHeight: rh, renderHeight: rh, renderWidth: rw, actualImageWidth: iw, actualImageHeight: ih });
    }
  };

  useEffect(() => {
    computeRenderMetrics();
    const handler = () => computeRenderMetrics();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImageIndex]);

  const currentImageRealIndex = displayOrder[currentImageIndex];
  const currentConfig = imageConfigs[currentImageRealIndex];
  
  // Log current config whenever it changes
  useEffect(() => {
    console.log(`📍 Current page changed to ${currentImageIndex + 1}, config:`, currentConfig);
  }, [currentImageIndex, currentConfig]);

  const updateCurrentConfig = (updates: Partial<ImageConfig>) => {
    console.log(`🔄 updateCurrentConfig called for index ${currentImageRealIndex}, updates:`, updates);
    setImageConfigs((prev) => {
      const newConfigs = prev.map((config, index) => {
        if (index === currentImageRealIndex) {
          const updated = { ...config, ...updates };
          console.log(`🔄 Updated config for index ${index} (page ${currentImageIndex + 1}):`, updated);
          return updated;
        }
        return config;
      });
      console.log(`🔄 New imageConfigs state:`, newConfigs);
      return newConfigs;
    });
  };

  // Log imageConfigs whenever it changes
  useEffect(() => {
    console.log(`📊 imageConfigs state updated:`, imageConfigs);
    console.log(`📊 Enabled flags:`, imageConfigs.map((c, i) => ({ page: i + 1, enabled: c.enabled })));
  }, [imageConfigs]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, target: 'main' | 'extra') => {
    if (!currentConfig.locked) {
      e.stopPropagation();
      setIsDragging(true);
      setDraggingTarget(target);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && draggingTarget && !currentConfig.locked) {
      const rect = e.currentTarget.getBoundingClientRect();
      const rm = renderMetrics;
      if (!rm) return;
      const localX = e.clientX - rect.left - rm.offsetX;
      const localY = e.clientY - rect.top - rm.offsetY;
      const x = Math.max(0, Math.min(100, (localX / rm.rw) * 100));
      const y = Math.max(0, Math.min(100, (localY / rm.rh) * 100));
      
      if (draggingTarget === 'main') {
        updateCurrentConfig({ x, y });
      } else if (draggingTarget === 'extra') {
        updateCurrentConfig({ extraX: x, extraY: y });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingTarget(null);
  };

  const handleContainerMouseEnter = () => {
    // Only enable zoom if there's text on the image
    if (currentConfig.enabled || currentConfig.extraText) {
      setIsHovering(true);
    }
  };

  const handleContainerMouseLeave = () => {
    setIsHovering(false);
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursorPos({ x, y });
  };

  const setExtraText = (value?: string) => {
    updateCurrentConfig({ extraText: value || undefined });
  };

  const togglePreset = (preset: string) => {
    if (currentConfig.extraText === preset) {
      setExtraText(undefined);
    } else {
      setExtraText(preset);
    }
  };

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < pdfImages.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const generateZIP = async () => {
    setIsGenerating(true);
    try {
      const payload = {
        images: imageConfigs
          .filter(config => config.enabled)
          .map(config => ({
            filename: `image${config.imageIndex + 1}.png`,
            imageBase64: images[config.imageIndex].split(',')[1], // Remove data URL prefix
            textBoxes: [
              {
                text: "Sample Name",
                x: config.x,
                y: config.y,
                fontSize: config.fontSize,
                color: config.fontColor,
                bold: config.bold,
                italic: config.italic,
                underline: config.underline
              },
              {
                text: "નમૂનો નામ",
                x: config.x,
                y: config.y + 5,
                fontSize: config.fontSize,
                color: config.fontColor,
                bold: config.bold,
                italic: config.italic,
                underline: config.underline
              }
            ]
          }))
      };

      const response = await fetch('http://localhost:5000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to generate ZIP');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cards.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating ZIP:', error);
      alert('Failed to generate ZIP. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
        </div>

        <h1 className="text-3xl mb-8">Place Names on Each PDF</h1>

        {/* Loading State */}
        {isLoadingPdfs ? (
          <Card className="mb-6">
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Loading PDF pages...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a moment for large PDFs</p>
            </CardContent>
          </Card>
        ) : pdfImages.length === 0 ? (
          <Card className="mb-6">
            <CardContent className="p-12 text-center">
              <p className="text-lg text-red-600 mb-2">No PDFs loaded. Please go back and upload a PDF.</p>
              <p className="text-sm text-gray-500 mb-4">
                Debug: pdfs.length={pdfs.length}, pdfImages.length={pdfImages.length}
                <br />
                pdfs array: {JSON.stringify(pdfs.map((p, i) => `PDF ${i + 1}: ${p.substring(0, 50)}...`))}
              </p>
              <Button onClick={onBack}>Go Back to Upload</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Image Navigation Tabs */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousImage}
                    disabled={currentImageIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  <Tabs value={currentImageIndex.toString()} onValueChange={(v) => setCurrentImageIndex(parseInt(v))}>
                    <TabsList>
                      {pdfImages.map((_, index) => (
                        <TabsTrigger key={index} value={index.toString()} className="relative">
                          PDF {index + 1}
                          {((imageConfigs[index].enabled || imageConfigs[index].extraText) && imageConfigs[index].locked) && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                          )}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextImage}
                    disabled={currentImageIndex === pdfImages.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* Left: Preview Canvas */}
          <Card className="flex items-center justify-center">
            <CardContent className="p-6 w-full flex flex-col items-center">
              <div className="flex items-center justify-between mb-4 w-full">
                <h3 className="text-lg">
                  PDF {currentImageIndex + 1} Preview
                </h3>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Add name to this PDF:</Label>
                  <input
                    type="checkbox"
                    checked={currentConfig.enabled}
                    onChange={(e) => {
                      console.log(`✅ Checkbox changed for page ${currentImageIndex + 1}: ${e.target.checked}`);
                      console.log("Current config before update:", currentConfig);
                      updateCurrentConfig({ enabled: e.target.checked });
                    }}
                    className="w-5 h-5"
                  />
                </div>
              </div>
              
              {/* Debug Info */}
                {renderErrors.length > 0 && (
                  <div className="mt-2 text-red-600 font-bold">
                    <div>ERRORS ({renderErrors.length}):</div>
                    {renderErrors.map((err, i) => <div key={i}>• {err}</div>)}
                  </div>
                )}
              <div className="w-full bg-gray-100 p-2 rounded mb-2 text-xs">
                <div>Current Index: {currentImageIndex}, Real Index: {currentImageRealIndex}</div>
                <div>PDF Images Array Length: {pdfImages.length}</div>
                <div>Current Image Exists: {pdfImages[currentImageRealIndex] ? 'YES' : 'NO'}</div>
                <div>Current Image Length: {pdfImages[currentImageRealIndex]?.length || 0}</div>
                <div>Loading: {isLoadingPdfs ? 'YES' : 'NO'}</div>
              </div>

              <div
                className={`relative bg-white border-2 rounded-lg ${
                  currentConfig.enabled || currentConfig.extraText ? "border-gray-300" : "border-gray-200 opacity-50"
                }`}
                style={{ 
                  aspectRatio: "3/4", 
                  maxHeight: "850px", 
                  width: "100%",
                  overflow: isHovering ? "hidden" : "visible",
                  cursor: isDragging ? "grabbing" : "grab"
                }}
                onMouseMove={(e) => {
                  handleContainerMouseMove(e);
                  if (currentConfig.enabled || currentConfig.extraText) handleMouseMove(e);
                }}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  handleContainerMouseLeave();
                  handleMouseUp();
                }}
                onMouseEnter={handleContainerMouseEnter}
                ref={containerRef}
              >
                {/* Zoom container */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    transform: isHovering ? `scale(1.5)` : "scale(1)",
                    transformOrigin: `${cursorPos.x}% ${cursorPos.y}%`,
                    transition: "transform 0.15s ease-out",
                  }}
                >
                <img
                    src={pdfImages[currentImageRealIndex]}
                    alt={`PDF ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                    ref={imgRef}
                    onLoad={() => {
                      console.log(`✅ Image loaded for PDF ${currentImageIndex + 1}`);
                      computeRenderMetrics();
                    }}
                    onError={(e) => {
                      console.error(`❌ Image load error for PDF ${currentImageIndex + 1}:`, e);
                      console.log("Image src preview:", (e.currentTarget as HTMLImageElement).src?.substring(0, 100));
                    }}
                    style={{ display: pdfImages[currentImageRealIndex] ? 'block' : 'none' }}
                  />
                  {!pdfImages[currentImageRealIndex] && (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <p>⚠️ PDF image not loaded</p>
                    </div>
                  )}
                  {renderMetrics && (
                    <>
                      {currentConfig.enabled && (
                        <svg
                          className="absolute"
                          style={{ left: renderMetrics.offsetX, top: renderMetrics.offsetY, width: renderMetrics.rw, height: renderMetrics.rh, pointerEvents: currentConfig.locked ? "none" : "auto" }}
                      >
                        <text
                          x={`${currentConfig.x}%`}
                          y={`${currentConfig.y}%`}
                          fontSize={`${currentConfig.fontSize}px`}
                          fontFamily={currentConfig.fontFamily}
                          fill={currentConfig.fontColor}
                          fontWeight={currentConfig.bold ? "bold" : "normal"}
                          fontStyle={currentConfig.italic ? "italic" : "normal"}
                          textDecoration={currentConfig.underline ? "underline" : "none"}
                          textAnchor="start"
                          dominantBaseline="middle"
                          direction="ltr"
                          style={{ textShadow: "0 0 4px rgba(255,255,255,0.8)", cursor: currentConfig.locked ? "default" : "move" }}
                          onMouseDown={(e) => handleMouseDown(e as any, 'main')}
                        >
                          {currentConfig.sampleText || firstName}
                        </text>
                      </svg>
                    )}
                    {currentConfig.extraText && (
                      <svg
                        className="absolute"
                        style={{ left: renderMetrics.offsetX, top: renderMetrics.offsetY, width: renderMetrics.rw, height: renderMetrics.rh, pointerEvents: currentConfig.locked ? "none" : "auto" }}
                      >
                        <text
                          x={`${currentConfig.extraX ?? 50}%`}
                          y={`${currentConfig.extraY ?? 60}%`}
                          fontSize={`${currentConfig.fontSize}px`}
                          fontFamily={currentConfig.fontFamily}
                          fill={currentConfig.fontColor}
                          fontWeight={currentConfig.bold ? "bold" : "normal"}
                          fontStyle={currentConfig.italic ? "italic" : "normal"}
                          textDecoration={currentConfig.underline ? "underline" : "none"}
                          textAnchor="start"
                          dominantBaseline="middle"
                          direction="ltr"
                          style={{ textShadow: "0 0 4px rgba(255,255,255,0.8)", cursor: currentConfig.locked ? "default" : "move" }}
                          onMouseDown={(e) => handleMouseDown(e as any, 'extra')}
                        >
                          {currentConfig.extraText}
                        </text>
                      </svg>
                    )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right: Controls */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-6">
                <h3 className="text-lg">Image {currentImageIndex + 1} Settings</h3>

                {!currentConfig.enabled && !currentConfig.extraText && (
                  <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-900">
                    Name placement is disabled for this image. Enable it to customize.
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Font Size: {currentConfig.fontSize}px</Label>
                  <Slider
                    value={[currentConfig.fontSize]}
                    onValueChange={([value]) => updateCurrentConfig({ fontSize: value })}
                    min={12}
                    max={72}
                    step={1}
                    disabled={!currentConfig.enabled && !currentConfig.extraText}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Font Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={currentConfig.fontColor}
                      onChange={(e) => updateCurrentConfig({ fontColor: e.target.value })}
                      className="w-20 h-10 cursor-pointer"
                      disabled={!currentConfig.enabled && !currentConfig.extraText}
                    />
                    <Input
                      type="text"
                      value={currentConfig.fontColor}
                      onChange={(e) => updateCurrentConfig({ fontColor: e.target.value })}
                      placeholder="#000000"
                      className="flex-1"
                      disabled={!currentConfig.enabled && !currentConfig.extraText}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select
                    value={currentConfig.fontFamily}
                    onValueChange={(value) => updateCurrentConfig({ fontFamily: value })}
                    disabled={!currentConfig.enabled && !currentConfig.extraText}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Noto Sans Gujarati">Noto Sans Gujarati</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Verdana">Verdana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Text Style</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={currentConfig.bold ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCurrentConfig({ bold: !currentConfig.bold })}
                      disabled={!currentConfig.enabled && !currentConfig.extraText}
                    >
                      <strong>B</strong>
                    </Button>
                    <Button
                      variant={currentConfig.italic ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCurrentConfig({ italic: !currentConfig.italic })}
                      disabled={!currentConfig.enabled && !currentConfig.extraText}
                    >
                      <em>I</em>
                    </Button>
                    <Button
                      variant={currentConfig.underline ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCurrentConfig({ underline: !currentConfig.underline })}
                      disabled={!currentConfig.enabled && !currentConfig.extraText}
                    >
                      <u>U</u>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Additional Text (Optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={currentConfig.extraText === "સર્વો" ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePreset("સર્વો")}
                    >
                      સર્વો
                    </Button>
                    <Button
                      variant={currentConfig.extraText === "સજોડે" ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePreset("સજોડે")}
                    >
                      સજોડે
                    </Button>
                    <Button
                      variant={showExtraTextInput ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (showExtraTextInput) {
                          // Hide input and clear text
                          setShowExtraTextInput(false);
                          setExtraText(undefined);
                        } else {
                          // Show input with empty string
                          setShowExtraTextInput(true);
                          setExtraText("");
                          // Focus after state update
                          setTimeout(() => {
                            extraTextInputRef.current?.focus();
                            extraTextInputRef.current?.select();
                          }, 0);
                        }
                      }}
                    >
                      Add text box
                    </Button>
                  </div>
                  {showExtraTextInput && (
                    <Input
                      ref={extraTextInputRef}
                      type="text"
                      value={currentConfig.extraText || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtraText(e.target.value || undefined)}
                      placeholder="Write custom text"
                      className="mt-2 border-2 border-blue-500 focus:border-blue-600"
                      onBlur={() => {
                        if (!currentConfig.extraText || currentConfig.extraText.trim() === "") {
                          setShowExtraTextInput(false);
                        }
                      }}
                    />
                  )}
                </div>

                <Button
                  className="w-full"
                  variant={currentConfig.locked ? "default" : "outline"}
                  onClick={() => updateCurrentConfig({ locked: !currentConfig.locked })}
                  disabled={!currentConfig.enabled && !currentConfig.extraText}
                >
                  {currentConfig.locked ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Position Locked
                    </>
                  ) : (
                    <>
                      <Move className="h-4 w-4 mr-2" />
                      Lock Position
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-900 space-y-2">
                <p>💡 <strong>Tips:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Drag the name to position it</li>
                  <li>Lock position when satisfied</li>
                  <li>Configure each page separately</li>
                  <li>Disable pages that don't need names</li>
                </ul>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  console.log("🔴 BEFORE sending - Full imageConfigs state:", imageConfigs);
                  console.log("🔴 BEFORE sending - Individual enabled flags:", imageConfigs.map((c, i) => ({ page: i + 1, enabled: c.enabled })));
                  
                  const orderedConfigs = displayOrder.map((idx, arrayIndex) => ({ 
                    ...imageConfigs[idx], 
                    order: arrayIndex 
                  }));
                  console.log("📤 Sending imageConfigs to next page:", orderedConfigs);
                  console.log("Enabled pages:", orderedConfigs.map((c, i) => `Page ${i + 1}: enabled=${c.enabled}`));
                  onNext(orderedConfigs);
                }}
              >
                Next - Merge Settings
              </Button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
