import { useRef, useState, useCallback, useEffect } from "react";

interface UseCameraStreamOptions {
  isActive: boolean;
  videoConstraints?: MediaTrackConstraints;
}

export const useCameraStream = ({
  isActive,
  videoConstraints = { facingMode: "user", width: 1280, height: 720 },
}: UseCameraStreamOptions) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return; // Already running

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true, // Include audio for video recording
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsReady(true);
      setError(null);
    } catch (err) {
      console.error("Failed to access camera:", err);
      setError("Camera access denied");
      setIsReady(false);
    }
  }, [videoConstraints]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  const getStream = useCallback(() => {
    return streamRef.current;
  }, []);

  // Assign video element ref
  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && streamRef.current) {
      element.srcObject = streamRef.current;
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isActive, startCamera, stopCamera]);

  return {
    videoRef,
    setVideoElement,
    isReady,
    error,
    getStream,
    startCamera,
    stopCamera,
  };
};

export default useCameraStream;
