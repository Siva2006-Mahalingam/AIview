import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Play, Download } from "lucide-react";

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function QuestionVideoDialog({
  videoRef,
  title = "Answer video",
  trigger,
}: {
  videoRef: string;
  title?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (isHttpUrl(videoRef)) {
          if (!cancelled) setVideoUrl(videoRef);
          return;
        }

        const { data, error: signedError } = await supabase.storage
          .from("answer-videos")
          .createSignedUrl(videoRef, 60 * 60); // 1 hour

        if (signedError || !data?.signedUrl) {
          throw new Error("Unable to load video");
        }

        if (!cancelled) setVideoUrl(data.signedUrl);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Video unavailable. Try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, videoRef]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      let downloadUrl = videoUrl;

      // If we don't have a URL yet, generate one
      if (!downloadUrl && !isHttpUrl(videoRef)) {
        const { data, error: signedError } = await supabase.storage
          .from("answer-videos")
          .createSignedUrl(videoRef, 60 * 5); // 5 minutes for download

        if (signedError || !data?.signedUrl) {
          throw new Error("Unable to generate download link");
        }
        downloadUrl = data.signedUrl;
      }

      if (!downloadUrl) {
        throw new Error("No video URL available");
      }

      // Fetch the video and create a blob for download
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview-answer-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Play className="h-4 w-4 mr-1" />
            Video
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>{title}</span>
            {videoUrl && !isLoading && !error && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Download
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : videoUrl ? (
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full rounded-lg bg-secondary"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default QuestionVideoDialog;
