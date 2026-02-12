import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmotionData {
  is_nervous: boolean;
  confidence_level: number;
  emotions: {
    happy: number;
    sad: number;
    angry: number;
    surprised: number;
    fearful: number;
    disgusted: number;
    neutral: number;
  };
}

interface CameraPreviewProps {
  sessionId: string;
  isActive: boolean;
  captureInterval?: number;
  onEmotionCaptured?: (emotions: EmotionData) => void;
}

export interface CameraPreviewRef {
  getStream: () => MediaStream | null;
}

export const CameraPreview = forwardRef<CameraPreviewRef, CameraPreviewProps>(
  ({ sessionId, isActive, captureInterval = 120000, onEmotionCaptured }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInitializedRef = useRef(false);
    // Store callback in ref to avoid dependency changes triggering re-renders
    const onEmotionCapturedRef = useRef(onEmotionCaptured);
    onEmotionCapturedRef.current = onEmotionCaptured;

    // Detect mobile for camera constraints
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Expose stream getter to parent
    useImperativeHandle(ref, () => ({
      getStream: () => streamRef.current,
    }));

    const startCamera = useCallback(async () => {
      if (streamRef.current || isInitializedRef.current) return;
      isInitializedRef.current = true;

      try {
        // Mobile-friendly constraints - lower resolution for better performance
        const constraints = {
          video: isMobile
            ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
            : { facingMode: "user", width: 1280, height: 720 },
          audio: true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Check if component is still active before setting stream
        if (!isInitializedRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          // Only set srcObject if it's different to avoid re-attaching the stream
          // which can cause a visible blink/flash in some browsers.
          if (videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
          }

          // Ensure element is muted (helps with autoplay policies) and play.
          try {
            videoRef.current.muted = true;
            await videoRef.current.play();
          } catch (playError) {
            if ((playError as Error).name !== 'AbortError') {
              console.error("Video play error:", playError);
            }
          }
        }
      } catch (error) {
        console.error("Failed to access camera:", error);
        isInitializedRef.current = false;
      }
    }, []);

    const stopCamera = useCallback(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (streamRef.current) {
        // Stop tracks but do not forcibly clear the video's srcObject.
        // Leaving srcObject prevents a quick visual flash in some browsers
        // by keeping the last rendered frame visible instead of reattaching
        // a null src and causing a blink when starting again.
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      isInitializedRef.current = false;
    }, []);

    const captureAndAnalyze = useCallback(async () => {
      if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx || video.readyState < 2) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to base64
      const imageData = canvas.toDataURL("image/jpeg", 0.8);

      try {
        const { data, error } = await supabase.functions.invoke("analyze-emotion", {
          body: { imageData, sessionId },
        });

        if (error) {
          console.error("Emotion analysis error:", error);
          return;
        }

        const emotionData: EmotionData = data;

        // Save snapshot to database
        await supabase.from("emotion_snapshots").insert({
          session_id: sessionId,
          emotions: emotionData.emotions,
          is_nervous: emotionData.is_nervous,
          confidence_level: emotionData.confidence_level,
        });

        // Use ref to avoid dependency on callback
        if (onEmotionCapturedRef.current) {
          onEmotionCapturedRef.current(emotionData);
        }
      } catch (error) {
        console.error("Failed to analyze emotion:", error);
      }
    }, [sessionId]);

    // Start camera only when isActive changes - separate from capture logic
    useEffect(() => {
      if (!isActive) {
        stopCamera();
        return;
      }

      startCamera();

      return () => {
        stopCamera();
      };
    }, [isActive, startCamera, stopCamera]);

    // Handle emotion capture interval separately to avoid restarting camera
    useEffect(() => {
      if (!isActive) return;

      let checkReadyInterval: ReturnType<typeof setInterval> | null = null;

      const startCapture = () => {
        if (intervalRef.current) return;

        intervalRef.current = setInterval(() => {
          captureAndAnalyze();
        }, captureInterval);

        // First capture after interval
        timeoutRef.current = setTimeout(() => captureAndAnalyze(), captureInterval);
      };

      // Wait for camera to be ready
      checkReadyInterval = setInterval(() => {
        if (streamRef.current && videoRef.current?.readyState >= 2) {
          if (checkReadyInterval) clearInterval(checkReadyInterval);
          startCapture();
        }
      }, 500);

      return () => {
        if (checkReadyInterval) clearInterval(checkReadyInterval);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }, [isActive, captureInterval, captureAndAnalyze]);

    return (
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full rounded-xl object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} className="hidden" />
        {isActive && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-2 py-1 rounded-full text-xs">
            <span className="w-2 h-2 rounded-full bg-destructive-foreground animate-pulse" />
            Recording
          </div>
        )}
      </div>
    );
  }
);

CameraPreview.displayName = "CameraPreview";

export default CameraPreview;
