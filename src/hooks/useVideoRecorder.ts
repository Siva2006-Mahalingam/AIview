import { useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VideoRecorderOptions {
  sessionId: string;
  userId: string;
}

export const useVideoRecorder = ({ sessionId, userId }: VideoRecorderOptions) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number | null>(null);

  const startRecording = useCallback(
    (questionNumber: number, existingStream: MediaStream | null) => {
      if (!existingStream) {
        console.error("No stream provided for recording");
        return false;
      }

      try {
        chunksRef.current = [];
        setCurrentQuestionNumber(questionNumber);

        const mediaRecorder = new MediaRecorder(existingStream, {
          mimeType: "video/webm;codecs=vp9",
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000); // Collect data every second
        setIsRecording(true);

        return true;
      } catch (error) {
        console.error("Failed to start recording:", error);
        return false;
      }
    },
    []
  );

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        // Create blob from chunks
        const blob = new Blob(chunksRef.current, { type: "video/webm" });

        if (blob.size === 0) {
          resolve(null);
          return;
        }

        // Upload to Supabase Storage
        const fileName = `${userId}/${sessionId}/q${currentQuestionNumber}-${Date.now()}.webm`;

        try {
          const { error: uploadError } = await supabase.storage
            .from("answer-videos")
            .upload(fileName, blob, {
              contentType: "video/webm",
              upsert: true,
            });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            resolve(null);
            return;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("answer-videos")
            .getPublicUrl(fileName);

          setIsRecording(false);
          setCurrentQuestionNumber(null);
          chunksRef.current = [];

          resolve(urlData.publicUrl);
        } catch (error) {
          console.error("Failed to upload video:", error);
          resolve(null);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, [isRecording, sessionId, userId, currentQuestionNumber]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setIsRecording(false);
    setCurrentQuestionNumber(null);
  }, [isRecording]);

  return {
    isRecording,
    currentQuestionNumber,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};

export default useVideoRecorder;
