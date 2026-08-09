import { useCallback, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

interface ResumeUploaderProps {
  onResumeText: (text: string) => void;
}

export default function ResumeUploader({ onResumeText }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showManualText, setShowManualText] = useState(false);
  const [manualText, setManualText] = useState("");

  const handleManualTextChange = (text: string) => {
    setManualText(text);
    if (text.trim().length > 0) {
      setResumeLoaded(true);
      setFileName("Pasted Resume Text");
      onResumeText(text.trim());
    } else {
      setResumeLoaded(false);
      setFileName(null);
      onResumeText("");
    }
  };

  const extractTextFromPDF = useCallback(async (file: File) => {
    if (!file.type.includes("pdf")) {
      setError("Please upload a PDF file.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use pdf.js to extract text
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      if (!fullText.trim()) {
        throw new Error("No text could be extracted from the PDF.");
      }

      setResumeLoaded(true);
      setFileName(file.name);
      onResumeText(fullText.trim());
    } catch (err: any) {
      setError(err.message || "Failed to read PDF. Try copying the text manually.");
    } finally {
      setIsLoading(false);
    }
  }, [onResumeText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) extractTextFromPDF(file);
  }, [extractTextFromPDF]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) extractTextFromPDF(file);
  }, [extractTextFromPDF]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label mb-0">Upload Your Resume <span className="text-destructive ml-0.5">*</span></label>
        <button
          type="button"
          onClick={() => setShowManualText(!showManualText)}
          className="text-xs font-semibold text-accent hover:underline cursor-pointer"
        >
          {showManualText ? "Use PDF Uploader" : "Or Paste Resume Text"}
        </button>
      </div>

      {showManualText ? (
        <div className="space-y-2">
          <textarea
            value={manualText}
            onChange={(e) => handleManualTextChange(e.target.value)}
            placeholder="Paste your resume text here (experience, skills, projects)..."
            rows={5}
            className="w-full rounded-xl border border-border p-3 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-y"
          />
          {resumeLoaded && (
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Resume text ready
            </p>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("resume-input")?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}
            ${resumeLoaded ? "bg-primary/5 border-primary/60" : ""}
          `}
        >
          <input
            id="resume-input"
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={handleChange}
          />

          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-foreground/60">Extracting text from PDF...</p>
            </div>
          ) : resumeLoaded ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-10 h-10 text-primary" />
              <p className="font-semibold text-primary">Resume Loaded</p>
              <p className="text-xs text-foreground/50">{fileName}</p>
              <p className="text-xs text-accent underline mt-1">Tap to replace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {error ? (
                <AlertCircle className="w-10 h-10 text-destructive" />
              ) : (
                <FileText className="w-10 h-10 text-foreground/30" />
              )}
              <div>
                <p className="font-semibold text-foreground/80">
                  {error ? error : "Drop your resume here or tap to browse"}
                </p>
                {!error && <p className="text-xs text-foreground/40 mt-1">PDF only</p>}
              </div>
              {!error && (
                <span className="flex items-center gap-1 text-sm text-accent">
                  <Upload className="w-4 h-4" />
                  Select PDF
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}