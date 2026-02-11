import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, bucket } = await req.json();

    if (!filePath || !bucket) {
      throw new Error("Missing filePath or bucket");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error("Failed to download file: " + (downloadError?.message || "Unknown error"));
    }

    // Get file extension
    const ext = filePath.split(".").pop()?.toLowerCase();

    let extractedText = "";

    // For text-based files, extract text directly
    if (ext === "txt" || ext === "md") {
      extractedText = await fileData.text();
    } else {
      // For PDF and other files, try to extract text content
      // Note: Full PDF parsing requires a dedicated library
      // For now, we'll try to read as text and clean up
      try {
        const rawText = await fileData.text();
        // Basic cleanup for PDF text extraction
        extractedText = rawText
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // If extracted text is too short or looks like binary, provide a fallback message
        if (extractedText.length < 50 || /^%PDF/.test(extractedText)) {
          extractedText = `Resume file uploaded: ${filePath}. File type: ${ext?.toUpperCase() || 'Unknown'}. Please review the resume content manually or provide resume details in text format for AI analysis.`;
        }
      } catch {
        extractedText = `Resume file uploaded: ${filePath}. Unable to extract text from this file format. Please provide resume details in text format for better AI analysis.`;
      }
    }

    console.log("Extracted text length:", extractedText.length);

    return new Response(
      JSON.stringify({ text: extractedText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
