import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText, Loader2, Check, X } from "lucide-react";

interface ResumeUploadProps {
  onUploadComplete: (resumeId: string, resumeText: string) => void;
  userId: string;
}

export const ResumeUpload = ({ onUploadComplete, userId }: ResumeUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parseProgress, setParseProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF or Word document");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploadedFile(file);
    await uploadAndParseResume(file);
  };

  const uploadAndParseResume = async (file: File) => {
    setIsUploading(true);
    setParseProgress("Uploading resume...");

    try {
      // Upload file to Supabase Storage
      const filePath = `${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file);

      if (uploadError) {
        throw new Error("Failed to upload file");
      }

      setIsUploading(false);
      setIsParsing(true);
      setParseProgress("Extracting text with OCR...");

      // Get the file URL
      const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;

      // Call edge function for OCR
      const { data: ocrData, error: ocrError } = await supabase.functions.invoke("extract-resume", {
        body: { filePath, bucket: "resumes" },
      });

      if (ocrError) {
        throw new Error("Failed to extract text from resume");
      }

      const resumeText = ocrData?.text || "";
      setParseProgress("Saving resume...");

      // Save resume to database
      const { data: resumeData, error: resumeError } = await supabase
        .from("resumes")
        .insert({
          user_id: userId,
          file_url: fileUrl,
          original_filename: file.name,
          ocr_text: resumeText,
        })
        .select()
        .single();

      if (resumeError) {
        throw new Error("Failed to save resume");
      }

      toast.success("Resume uploaded and parsed successfully!");
      onUploadComplete(resumeData.id, resumeText);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to process resume");
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
      setIsParsing(false);
      setParseProgress("");
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
  };

  return (
    <div className="w-full">
      {!uploadedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-secondary/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium mb-2">
            Drop your resume here or click to browse
          </p>
          <p className="text-muted-foreground text-sm">
            Supports PDF and Word documents (max 10MB)
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{uploadedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {(isUploading || isParsing) && (
                <div className="flex items-center gap-2 mt-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-primary">{parseProgress}</span>
                </div>
              )}
              {!isUploading && !isParsing && (
                <div className="flex items-center gap-2 mt-2">
                  <Check className="h-4 w-4 text-interview-success" />
                  <span className="text-sm text-interview-success">Ready</span>
                </div>
              )}
            </div>
            {!isUploading && !isParsing && (
              <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
