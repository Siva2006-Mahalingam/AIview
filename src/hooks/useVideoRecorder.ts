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
  const isRecordingRef = useRef(false); // Use ref to avoid stale closure
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number | null>(null);
  const currentQuestionNumberRef = useRef<number | null>(null);

  const startRecording = useCallback(
    (questionNumber: number, existingStream: MediaStream | null) => {
      if (!existingStream) {
        console.error("useVideoRecorder: No stream provided for recording");
        return false;
      }

      try {
        chunksRef.current = [];
        setCurrentQuestionNumber(questionNumber);
        currentQuestionNumberRef.current = questionNumber;

        const preferredTypes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ];
        const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t));
        console.log("useVideoRecorder: Starting recording for Q", questionNumber, "with mimeType", mimeType);

        // Use lower bitrate for faster uploads (500kbps video + 64kbps audio)
        const options: MediaRecorderOptions = {
          videoBitsPerSecond: 500000,
          audioBitsPerSecond: 64000,
        };
        if (mimeType) options.mimeType = mimeType;

        const mediaRecorder = new MediaRecorder(existingStream, options);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000); // Collect data every second
        setIsRecording(true);
        isRecordingRef.current = true;
        console.log("useVideoRecorder: Recording started");

        return true;
      } catch (error) {
        console.error("useVideoRecorder: Failed to start recording:", error);
        return false;
      }
    },
    []
  );

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecordingRef.current) {
        console.log("useVideoRecorder: stopRecording called but not recording, isRecording:", isRecordingRef.current);
        resolve(null);
        return;
      }

      const questionNum = currentQuestionNumberRef.current;
      console.log("useVideoRecorder: Stopping recording for Q", questionNum);

      mediaRecorderRef.current.onstop = async () => {
        // Create blob from chunks
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        console.log("useVideoRecorder: Recording stopped, blob size:", blob.size, "chunks:", chunksRef.current.length);

        if (blob.size === 0) {
          console.warn("useVideoRecorder: Empty blob, no video data");
          resolve(null);
          return;
        }

        // Upload to Storage (private bucket) — store the *path* in DB, not a public URL
        const fileName = `${userId}/${sessionId}/q${questionNum}-${Date.now()}.webm`;
        console.log("useVideoRecorder: Uploading to", fileName);

        try {
          const { error: uploadError } = await supabase.storage
            .from("answer-videos")
            .upload(fileName, blob, {
              contentType: "video/webm",
              upsert: true,
            });

          if (uploadError) {
            // Bucket may not exist - fail silently
            if (uploadError.message?.includes("Bucket not found")) {
              console.warn("useVideoRecorder: Video storage not configured - skipping video upload");
            } else {
              console.warn("useVideoRecorder: Video upload failed:", uploadError.message);
            }
            resolve(null);
            return;
          }

          console.log("useVideoRecorder: Upload successful:", fileName);
          setIsRecording(false);
          isRecordingRef.current = false;
          setCurrentQuestionNumber(null);
          currentQuestionNumberRef.current = null;
          chunksRef.current = [];

          // Return storage path; History will generate a signed URL
          resolve(fileName);
        } catch (error) {
          console.error("useVideoRecorder: Failed to upload video:", error);
          resolve(null);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, [sessionId, userId]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setIsRecording(false);
    isRecordingRef.current = false;
    setCurrentQuestionNumber(null);
    currentQuestionNumberRef.current = null;
  }, []);

  return {
    isRecording,
    currentQuestionNumber,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};

export default useVideoRecorder;
