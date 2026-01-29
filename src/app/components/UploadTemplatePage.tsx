import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Upload, FileText, CheckCircle, X } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// Set up PDF.js worker - use local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
console.log("📄 PDF.js worker configured:", pdfjsLib.GlobalWorkerOptions.workerSrc);

interface UploadTemplatePageProps {
  onNext: (pdfs: string[]) => void;
  onBack: () => void;
}

interface PdfPreview {
  dataUrl: string;
  thumbnail: string;
}

export function UploadTemplatePage({ onNext, onBack }: UploadTemplatePageProps) {
  const [pdfs, setPdfs] = useState<PdfPreview[]>([]);
  const [isUploaded, setIsUploaded] = useState(false);

  const generatePdfThumbnail = async (pdfDataUrl: string): Promise<string> => {
    try {
      console.log("🔵 Generating PDF thumbnail...");
      const base64Index = pdfDataUrl.indexOf(",");
      if (base64Index === -1) {
        console.error("❌ Invalid data URL format");
        return "";
      }
      
      const base64String = pdfDataUrl.substring(base64Index + 1);
      console.log("🔵 Base64 extracted, length:", base64String.length);
      
      const pdfData = atob(base64String);
      const pdfArray = new Uint8Array(pdfData.length);
      for (let i = 0; i < pdfData.length; i++) {
        pdfArray[i] = pdfData.charCodeAt(i);
      }
      console.log("🔵 PDF decoded, byte array size:", pdfArray.length);

      console.log("🔵 Loading PDF document for thumbnail...");
      const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
      console.log("✅ PDF loaded, pages:", pdf.numPages);
      
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 4 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not get canvas context");
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as any).promise;
      
      const thumbnailUrl = canvas.toDataURL("image/png");
      console.log("✅ Thumbnail generated, size:", thumbnailUrl.length);
      return thumbnailUrl;
    } catch (error) {
      console.error("❌ Error generating PDF thumbnail:", error);
      return "";
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      const pdfPromises = acceptedFiles.map(async (file) => {
        return new Promise<PdfPreview>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const dataUrl = reader.result as string;
              const thumbnail = await generatePdfThumbnail(dataUrl);
              resolve({ dataUrl, thumbnail });
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const pdfPreviews = await Promise.all(pdfPromises);
      setPdfs(pdfPreviews);
      setIsUploaded(true);
    } catch (error) {
      console.error("Error processing PDFs:", error);
      alert("Error processing PDF files. Please try again.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 10,
  });

  const handleNext = () => {
    if (pdfs.length > 0) {
      onNext(pdfs.map(p => p.dataUrl));
    }
  };

  const removePdf = (index: number) => {
    const newPdfs = pdfs.filter((_, i) => i !== index);
    setPdfs(newPdfs);
    if (newPdfs.length === 0) {
      setIsUploaded(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
        </div>

        <h1 className="text-3xl mb-8">Upload Wedding Card PDF Template</h1>

        <Card className="mb-6">
          <CardContent className="p-8">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-blue-500 bg-blue-50"
                  : isUploaded
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                {isUploaded ? (
                  <>
                    <CheckCircle className="h-16 w-16 text-green-600" />
                    <div>
                      <p className="text-lg mb-1">✔ PDFs uploaded successfully</p>
                      <p className="text-sm text-gray-600">{pdfs.length} PDF(s) uploaded</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPdfs([]);
                          setIsUploaded(false);
                        }}
                      >
                        Change PDFs
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-16 w-16 text-gray-400" />
                    <div>
                      <p className="text-lg mb-1">
                        {isDragActive ? "Drop the PDF here" : "Drag & drop PDF file here"}
                      </p>
                      <p className="text-sm text-gray-500">or click to browse</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600 text-center">
                ✓ Supported format: PDF (max 10 files)
              </p>
              <p className="text-sm text-gray-600 text-center">
                ✓ Upload your wedding card PDF template
              </p>
            </div>
          </CardContent>
        </Card>

        {isUploaded && pdfs.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg mb-4">PDF Previews</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pdfs.map((pdf, index) => (
                  <div key={index} className="relative group">
                    {pdf.thumbnail ? (
                      <img
                        src={pdf.thumbnail}
                        alt={`PDF ${index + 1} preview`}
                        className="w-full h-48 object-cover rounded-lg border border-gray-200 bg-gray-100"
                      />
                    ) : (
                      <div className="w-full h-48 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
                        <FileText className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePdf(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <p className="text-xs text-center mt-1 text-gray-600">PDF {index + 1}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button size="lg" onClick={handleNext} disabled={!isUploaded || pdfs.length === 0}>
            Next - Place Names on PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
