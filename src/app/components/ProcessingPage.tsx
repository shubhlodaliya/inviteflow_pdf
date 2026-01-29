import { useEffect, useState, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { CheckCircle, Download, Loader2 } from "lucide-react";
import { PDFDocument, rgb } from "pdf-lib";
import JSZip from "jszip";
import { ImageConfig } from "./NamePlacementEditor";

// Helper function to render text to image using canvas
const renderTextToImage = async (
  text: string,
  fontSize: number,
  fontFamily: string,
  fontColor: string,
  bold: boolean,
  italic: boolean,
  underline: boolean
): Promise<string> => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  
  // Set font style
  const fontWeight = bold ? "bold" : "normal";
  const fontStyle = italic ? "italic" : "normal";
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
  
  // Measure text
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.5; // Add padding
  
  // Set canvas size
  canvas.width = textWidth + 20; // Add padding
  canvas.height = textHeight + 20;
  
  // Clear and set background to transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Re-apply font after canvas resize
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.fillStyle = fontColor;
  ctx.textBaseline = "middle";
  
  // Draw text
  ctx.fillText(text, 10, canvas.height / 2);
  
  // Draw underline if needed
  if (underline) {
    ctx.strokeStyle = fontColor;
    ctx.lineWidth = Math.max(1, fontSize / 12);
    ctx.beginPath();
    ctx.moveTo(10, canvas.height / 2 + fontSize / 2);
    ctx.lineTo(10 + textWidth, canvas.height / 2 + fontSize / 2);
    ctx.stroke();
  }
  
  return canvas.toDataURL("image/png");
};

interface ProcessingPageProps {
  names: string[];
  pdfs: string[]; // Changed from images to pdfs (base64 strings)
  imageConfigs: ImageConfig[];
  onComplete?: () => void;
}

const ensureFontsLoaded = async (configs: ImageConfig[]) => {
  if (!("fonts" in document)) return;
  const uniqueFamilies = Array.from(new Set(configs.map((c) => c.fontFamily).filter(Boolean)));
  const maxSize = Math.max(...configs.map((c) => c.fontSize || 16), 16);
  const loaders = uniqueFamilies.flatMap((family) => {
    const quoted = family.includes(" ") ? `"${family}"` : family;
    return [
      document.fonts.load(`400 ${maxSize}px ${quoted}`),
      document.fonts.load(`700 ${maxSize}px ${quoted}`),
    ];
  });
  await Promise.allSettled(loaders);
  await (document.fonts as FontFaceSet).ready;
};

// Helper function to parse color to RGB values for pdf-lib
const parseColorToRgb = (colorStr: string): { red: number; green: number; blue: number } => {
  const hex = colorStr.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return { red: r, green: g, blue: b };
};

export function ProcessingPage({ names, pdfs, imageConfigs, onComplete }: ProcessingPageProps) {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedZipUrl, setGeneratedZipUrl] = useState<string | null>(null);
  const [isCreatingZip, setIsCreatingZip] = useState(false);
  const progressRef = useRef(0); // Track progress to ensure it only increases

  const namesCount = names.length;
  
  console.log("📥 ProcessingPage received imageConfigs:", imageConfigs);
  console.log("Enabled pages in received configs:", imageConfigs.map((c, i) => `Page ${i + 1}: enabled=${c.enabled}, x=${c.x}, y=${c.y}`));

  useEffect(() => {
    generatePDFs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatePDFs = async () => {
    try {
      setError(null);
      setIsComplete(false);
      setProgress(0);
      progressRef.current = 0;

      // Ensure webfonts are available before rendering text to images
      await ensureFontsLoaded(imageConfigs);

      const zip = new JSZip();
      const totalCards = names.length;
      
      // Get the first PDF as template (all PDFs should have same structure)
      const templatePdfUrl = pdfs[0];
      const templatePdfBytes = await fetch(templatePdfUrl).then(res => res.arrayBuffer());
      const templatePdf = await PDFDocument.load(templatePdfBytes);
      
      // Process in batches to avoid memory exhaustion
      const batchSize = totalCards > 2000 ? 5 : totalCards > 500 ? 15 : totalCards > 100 ? 50 : 100;
      const totalPages = templatePdf.getPageCount();
      const totalItems = totalCards;

      for (let i = 0; i < totalCards; i++) {
        const name = names[i];
        
        console.log(`🔵 Generating PDF for name: ${name} (${i + 1}/${totalCards})`);
        
        // Load and copy the template PDF for each name
        const pdfBytes = await fetch(templatePdfUrl).then(res => res.arrayBuffer());
        const pdf = await PDFDocument.load(pdfBytes);
        
        const pageCount = pdf.getPageCount();
        console.log(`📄 PDF has ${pageCount} pages`);
        console.log(`⚙️ imageConfigs has ${imageConfigs.length} configs`);
        
        // Add name to each configured page
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          const config = imageConfigs[pageIndex];
          
          console.log(`🔍 Page ${pageIndex + 1}: config exists=${!!config}, enabled=${config?.enabled}, extraText=${!!config?.extraText}`);
          
          if (!config) {
            console.log(`⚠️ No config for page ${pageIndex + 1}, skipping`);
            continue;
          }
          
          const page = pdf.getPage(pageIndex);
          const { width, height } = page.getSize();
          
          console.log(`📐 Page ${pageIndex + 1} PDF size: ${width}x${height}`);
          
          // Add main text if enabled
          if (config.enabled) {
            const textX = (config.x / 100) * width;
            const textY = height - (config.y / 100) * height; // Flip Y since PDF coords are bottom-up
            
            console.log(`✍️ Page ${pageIndex + 1}: Adding text "${name}" at (${textX.toFixed(2)}, ${textY.toFixed(2)}), size=${config.fontSize}, color=${config.fontColor}`);
            
            try {
              // Render text to image
              const textImageDataUrl = await renderTextToImage(
                name || config.sampleText || "",
                config.fontSize || 24,
                config.fontFamily || "Noto Sans Gujarati",
                config.fontColor || "#000000",
                config.bold || false,
                config.italic || false,
                config.underline || false
              );
              
              // Embed image in PDF
              const textImage = await pdf.embedPng(textImageDataUrl);
              const textDims = textImage.scale(1);
              
              page.drawImage(textImage, {
                x: textX,
                y: textY - textDims.height / 2, // Center vertically
                width: textDims.width,
                height: textDims.height,
              });
              
              console.log(`✅ Text image drawn successfully on page ${pageIndex + 1}`);
            } catch (textError) {
              console.error(`❌ Error drawing text on page ${pageIndex + 1}:`, textError);
            }
          } else {
            console.log(`ℹ️ Text not enabled for page ${pageIndex + 1}`);
          }
          
          // Add extra text if present
          if (config.extraText) {
            const extraX = ((config.extraX ?? 50) / 100) * width;
            const extraY = height - ((config.extraY ?? 60) / 100) * height;
            
            console.log(`✍️ Page ${pageIndex + 1}: Adding extra text "${config.extraText}" at (${extraX.toFixed(2)}, ${extraY.toFixed(2)})`);
            
            try {
              // Render text to image
              const extraTextImageDataUrl = await renderTextToImage(
                config.extraText,
                config.fontSize || 24,
                config.fontFamily || "Noto Sans Gujarati",
                config.fontColor || "#000000",
                config.bold || false,
                config.italic || false,
                config.underline || false
              );
              
              // Embed image in PDF
              const extraTextImage = await pdf.embedPng(extraTextImageDataUrl);
              const extraTextDims = extraTextImage.scale(1);
              
              page.drawImage(extraTextImage, {
                x: extraX,
                y: extraY - extraTextDims.height / 2,
                width: extraTextDims.width,
                height: extraTextDims.height,
              });
              
              console.log(`✅ Extra text image drawn successfully on page ${pageIndex + 1}`);
            } catch (textError) {
              console.error(`❌ Error drawing extra text on page ${pageIndex + 1}:`, textError);
            }
          }
        }
        
        // Save PDF
        console.log(`💾 Saving PDF for ${name}`);
        const pdfData = await pdf.save();
        zip.file(`${name}.pdf`, pdfData);

        // Update progress
        const currentProgress = Math.floor(((i + 1) / totalItems) * 100);
        if (currentProgress > progressRef.current) {
          progressRef.current = currentProgress;
          setProgress(currentProgress);
        }

        // Allow browser to process events periodically
        if ((i + 1) % batchSize === 0) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      setIsCreatingZip(true);
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
      });
      const zipUrl = URL.createObjectURL(zipBlob);
      setGeneratedZipUrl(zipUrl);
      setIsCreatingZip(false);
      progressRef.current = 100;
      setProgress(100);
      setIsComplete(true);
    } catch (err: any) {
      console.error("Error generating PDFs:", err);
      setError(err?.message || "Failed to generate PDFs. Please try again.");
    }
  };

  const handleDownload = () => {
    if (!generatedZipUrl) return;

    const link = document.createElement("a");
    link.href = generatedZipUrl;
    link.download = "wedding_cards.zip";
    link.click();

    if (onComplete) {
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl bg-white shadow-lg">
        <CardContent className="p-8">
          {error ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-3xl">❌</span>
                </div>
              </div>
              <div>
                <h2 className="text-2xl mb-2 text-red-600">Error</h2>
                <p className="text-gray-600">{error}</p>
              </div>
              <Button onClick={generatePDFs} variant="outline">
                Try Again
              </Button>
            </div>
          ) : !isComplete ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
              </div>
              <div>
                <h2 className="text-2xl mb-2">
                  {isCreatingZip ? "Creating ZIP file..." : "Generating PDFs..."}
                </h2>
                <p className="text-gray-600">
                  {isCreatingZip 
                    ? "Compressing all PDFs into a single file" 
                    : "Please wait while we create your personalized cards"}
                </p>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <p className="text-sm text-gray-600">{progress}% Complete</p>
              </div>
              {!isCreatingZip && (
                <div className="text-sm text-gray-500">
                  Processing {Math.floor((progress / 100) * namesCount)} of {namesCount} cards
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl mb-2">✔ Files Ready!</h2>
                <p className="text-gray-600">Your personalized wedding cards are ready to download</p>
              </div>

              <Card className="bg-gray-50">
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Files</p>
                      <p className="text-2xl">{namesCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Format</p>
                      <p className="text-2xl">ZIP</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button size="lg" className="w-full gap-2" onClick={handleDownload} disabled={!generatedZipUrl}>
                <Download className="h-5 w-5" />
                Download ZIP File
              </Button>

              <p className="text-xs text-gray-500">The ZIP file contains all your personalized PDF cards</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProcessingPage;