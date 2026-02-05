import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmotionCaptureProps {
  sessionId: string;
  userId: string;
  isActive: boolean;
  captureInterval?: number; // in milliseconds
  onEmotionCaptured?: (emotions: EmotionData) => void;
}

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

export const EmotionCapture = ({
  sessionId,
  userId,
  isActive,
  captureInterval = 120000, // 2 minutes default to avoid rate limits
  onEmotionCaptured,
}: EmotionCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Failed to access camera:", error);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64
    const imageData = canvas.toDataURL("image/jpeg", 0.8);

    try {
      // Call edge function for emotion analysis
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

      if (onEmotionCaptured) {
        onEmotionCaptured(emotionData);
      }
    } catch (error) {
      console.error("Failed to analyze emotion:", error);
    }
  }, [sessionId, onEmotionCaptured]);

  useEffect(() => {
    if (isActive) {
      startCamera();

      // Start periodic capture
      intervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, captureInterval);

      // Initial capture after a short delay
      setTimeout(() => captureAndAnalyze(), 2000);
    } else {
      stopCamera();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      stopCamera();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, captureInterval, startCamera, stopCamera, captureAndAnalyze]);

  return (
    <div className="relative">
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
};
