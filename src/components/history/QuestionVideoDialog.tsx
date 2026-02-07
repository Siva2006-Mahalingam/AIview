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
import { Loader2, Play } from "lucide-react";

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
          <DialogTitle>{title}</DialogTitle>
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
