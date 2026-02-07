import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play, Loader2, VideoOff } from "lucide-react";

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

interface VideoThumbnailProps {
  videoRef: string;
  onClick?: () => void;
}

export function VideoThumbnail({ videoRef, onClick }: VideoThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState<string | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadThumbnail = async () => {
      setIsLoading(true);
      setError(false);

      try {
        let url: string;

        if (isHttpUrl(videoRef)) {
          url = videoRef;
        } else {
          const { data, error: signedError } = await supabase.storage
            .from("answer-videos")
            .createSignedUrl(videoRef, 60 * 5); // 5 minutes for thumbnail

          if (signedError || !data?.signedUrl) {
            throw new Error("Unable to get video URL");
          }
          url = data.signedUrl;
        }

        if (cancelled) return;

        // Create a hidden video to extract thumbnail and duration
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        videoElementRef.current = video;

        video.onloadedmetadata = () => {
          if (cancelled) return;

          // Format duration
          const mins = Math.floor(video.duration / 60);
          const secs = Math.floor(video.duration % 60);
          setDuration(`${mins}:${secs.toString().padStart(2, "0")}`);

          // Seek to 1 second for thumbnail
          video.currentTime = Math.min(1, video.duration * 0.1);
        };

        video.onseeked = () => {
          if (cancelled) return;

          try {
            const canvas = document.createElement("canvas");
            canvas.width = 160;
            canvas.height = 90;
            const ctx = canvas.getContext("2d");

            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
              setThumbnailUrl(dataUrl);
            }
          } catch (e) {
            console.error("Canvas error:", e);
            setError(true);
          } finally {
            setIsLoading(false);
          }
        };

        video.onerror = () => {
          if (!cancelled) {
            setError(true);
            setIsLoading(false);
          }
        };

        video.src = url;
        video.load();
      } catch (e) {
        console.error("Thumbnail error:", e);
        if (!cancelled) {
          setError(true);
          setIsLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      cancelled = true;
      if (videoElementRef.current) {
        videoElementRef.current.src = "";
        videoElementRef.current = null;
      }
    };
  }, [videoRef]);

  if (isLoading) {
    return (
      <div className="w-20 h-12 rounded-lg bg-secondary flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !thumbnailUrl) {
    return (
      <div className="w-20 h-12 rounded-lg bg-secondary flex items-center justify-center">
        <VideoOff className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="relative w-20 h-12 rounded-lg overflow-hidden group hover:ring-2 hover:ring-primary transition-all"
    >
      <img
        src={thumbnailUrl}
        alt="Video thumbnail"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
        <Play className="h-4 w-4 text-white fill-white" />
      </div>
      {duration && (
        <span className="absolute bottom-0.5 right-0.5 text-[10px] bg-black/70 text-white px-1 rounded">
          {duration}
        </span>
      )}
    </button>
  );
}

export default VideoThumbnail;
