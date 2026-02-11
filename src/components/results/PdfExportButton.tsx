import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QuestionData {
  question_number: number;
  question: string;
  answer: string | null;
  score: number | null;
  feedback: string | null;
}

interface PdfExportButtonProps {
  sessionData: {
    interviewType?: string;
    role?: string;
    atsScore: number | null;
    performancePercentage: number | null;
    overallFeedback: string | null;
    improvements: string | null;
    questions: QuestionData[];
    emotionSummary?: {
      avgConfidence: number;
      nervousCount: number;
      totalSnapshots: number;
    } | null;
    date?: string;
  };
}

export function PdfExportButton({ sessionData }: PdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Load html2pdf at runtime. Use existing global if present, otherwise
      // load the bundled script from jsDelivr to avoid Vite import resolution errors.
      const loadHtml2Pdf = async () => {
        const win = window as any;
        if (win && win.html2pdf) return win.html2pdf;

        // Fallback: inject CDN script
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-html2pdf]');
          if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Failed to load html2pdf from CDN')));
            return;
          }

          const script = document.createElement('script');
          script.setAttribute('data-html2pdf', 'true');
          script.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.14.0/dist/html2pdf.bundle.min.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load html2pdf from CDN'));
          document.head.appendChild(script);
        });

        return (window as any).html2pdf;
      };

      const html2pdf = await loadHtml2Pdf();

      // Create a hidden container for the PDF content
      const container = document.createElement("div");
      container.style.padding = "40px";
      container.style.fontFamily = "system-ui, sans-serif";
      container.style.backgroundColor = "#ffffff";
      container.style.color = "#1a1a1a";
      container.style.maxWidth = "800px";

      const getScoreColor = (score: number | null) => {
        if (score === null) return "#666";
        if (score >= 80) return "#22c55e";
        if (score >= 60) return "#eab308";
        return "#ef4444";
      };

      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 32px; border-bottom: 2px solid #e5e5e5; padding-bottom: 24px;">
          <h1 style="font-size: 28px; font-weight: bold; margin: 0 0 8px 0; color: #1a1a1a;">
            Interview Results Report
          </h1>
          <p style="color: #666; margin: 0; font-size: 14px;">
            ${sessionData.interviewType?.charAt(0).toUpperCase()}${sessionData.interviewType?.slice(1)} Interview for ${sessionData.role || "N/A"}
          </p>
          <p style="color: #999; margin: 8px 0 0 0; font-size: 12px;">
            ${sessionData.date || new Date().toLocaleDateString()}
          </p>
        </div>

        <div style="display: flex; justify-content: space-around; margin-bottom: 32px; text-align: center;">
          <div style="flex: 1; padding: 16px; background: #f9f9f9; border-radius: 12px; margin: 0 8px;">
            <p style="color: #666; font-size: 12px; margin: 0 0 4px 0;">ATS Score</p>
            <p style="font-size: 32px; font-weight: bold; margin: 0; color: ${getScoreColor(sessionData.atsScore)};">
              ${sessionData.atsScore ?? "-"}/100
            </p>
          </div>
          <div style="flex: 1; padding: 16px; background: #f9f9f9; border-radius: 12px; margin: 0 8px;">
            <p style="color: #666; font-size: 12px; margin: 0 0 4px 0;">Performance</p>
            <p style="font-size: 32px; font-weight: bold; margin: 0; color: ${getScoreColor(sessionData.performancePercentage)};">
              ${sessionData.performancePercentage ?? "-"}%
            </p>
          </div>
          <div style="flex: 1; padding: 16px; background: #f9f9f9; border-radius: 12px; margin: 0 8px;">
            <p style="color: #666; font-size: 12px; margin: 0 0 4px 0;">Avg Confidence</p>
            <p style="font-size: 32px; font-weight: bold; margin: 0; color: ${getScoreColor(sessionData.emotionSummary?.avgConfidence ?? null)};">
              ${sessionData.emotionSummary?.avgConfidence ?? "-"}%
            </p>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 12px 0; color: #22c55e;">
            ✓ Overall Feedback
          </h2>
          <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e;">
            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${sessionData.overallFeedback || "No feedback available."}</p>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 12px 0; color: #eab308;">
            ⚠ Areas for Improvement
          </h2>
          <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; border-left: 4px solid #eab308;">
            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${sessionData.improvements || "No specific improvements identified."}</p>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
            Question-by-Question Analysis
          </h2>
          ${sessionData.questions
            .map(
              (q) => `
            <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; margin-bottom: 12px; page-break-inside: avoid;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="background: ${getScoreColor(q.score)}20; color: ${getScoreColor(q.score)}; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  Q${q.question_number}: ${q.score ?? "?"}/100
                </span>
              </div>
              <p style="font-weight: 600; margin: 0 0 8px 0; color: #1a1a1a;">Question:</p>
              <p style="margin: 0 0 12px 0; color: #333;">${q.question}</p>
              <p style="font-weight: 600; margin: 0 0 8px 0; color: #1a1a1a;">Your Answer:</p>
              <p style="margin: 0 0 12px 0; color: #333;">${q.answer || "No answer provided"}</p>
              ${
                q.feedback
                  ? `
                <div style="background: #e5e5e5; padding: 12px; border-radius: 6px; margin-top: 8px;">
                  <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 13px;">Feedback:</p>
                  <p style="margin: 0; color: #555; font-size: 13px;">${q.feedback}</p>
                </div>
              `
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>

        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e5e5; color: #999; font-size: 12px;">
          <p style="margin: 0;">Generated by AI Interview Coach • ${new Date().toLocaleString()}</p>
        </div>
      `;

      document.body.appendChild(container);

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `interview-results-${sessionData.role?.replace(/\s+/g, "-").toLowerCase() || "report"}-${Date.now()}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      await html2pdf().set(opt).from(container).save();

      document.body.removeChild(container);
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
      {isExporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {isExporting ? "Exporting..." : "Export PDF"}
    </Button>
  );
}

export default PdfExportButton;
