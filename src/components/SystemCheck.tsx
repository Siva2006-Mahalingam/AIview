import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Mic, Monitor, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";

interface SystemCheckProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface CheckStatus {
  camera: "pending" | "checking" | "success" | "error";
  microphone: "pending" | "checking" | "success" | "error";
  fullscreen: "pending" | "checking" | "success" | "error";
}

export const SystemCheck = ({ onComplete, onCancel }: SystemCheckProps) => {
  const [status, setStatus] = useState<CheckStatus>({
    camera: "pending",
    microphone: "pending",
    fullscreen: "pending",
  });
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});
  const [allPassed, setAllPassed] = useState(false);

  const checkCamera = useCallback(async () => {
    setStatus((prev) => ({ ...prev, camera: "checking" }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setStatus((prev) => ({ ...prev, camera: "success" }));
      return true;
    } catch (error) {
      setStatus((prev) => ({ ...prev, camera: "error" }));
      setErrorMessages((prev) => ({
        ...prev,
        camera: "Camera access denied. Please allow camera access in your browser settings.",
      }));
      return false;
    }
  }, []);

  const checkMicrophone = useCallback(async () => {
    setStatus((prev) => ({ ...prev, microphone: "checking" }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setStatus((prev) => ({ ...prev, microphone: "success" }));
      return true;
    } catch (error) {
      setStatus((prev) => ({ ...prev, microphone: "error" }));
      setErrorMessages((prev) => ({
        ...prev,
        microphone: "Microphone access denied. Please allow microphone access in your browser settings.",
      }));
      return false;
    }
  }, []);

  const checkFullscreen = useCallback(async () => {
    setStatus((prev) => ({ ...prev, fullscreen: "checking" }));
    try {
      if (document.fullscreenEnabled) {
        setStatus((prev) => ({ ...prev, fullscreen: "success" }));
        return true;
      } else {
        throw new Error("Fullscreen not supported");
      }
    } catch (error) {
      setStatus((prev) => ({ ...prev, fullscreen: "error" }));
      setErrorMessages((prev) => ({
        ...prev,
        fullscreen: "Fullscreen mode is not supported in your browser.",
      }));
      return false;
    }
  }, []);

  const runAllChecks = useCallback(async () => {
    const results = await Promise.all([checkCamera(), checkMicrophone(), checkFullscreen()]);
    setAllPassed(results.every((r) => r));
  }, [checkCamera, checkMicrophone, checkFullscreen]);

  useEffect(() => {
    runAllChecks();
  }, [runAllChecks]);

  const retryCheck = async (check: keyof CheckStatus) => {
    if (check === "camera") await checkCamera();
    if (check === "microphone") await checkMicrophone();
    if (check === "fullscreen") await checkFullscreen();
    
    // Re-evaluate all passed
    setAllPassed(
      status.camera === "success" &&
      status.microphone === "success" &&
      status.fullscreen === "success"
    );
  };

  const getStatusIcon = (checkStatus: CheckStatus[keyof CheckStatus]) => {
    switch (checkStatus) {
      case "pending":
        return <div className="w-6 h-6 rounded-full bg-secondary" />;
      case "checking":
        return <Loader2 className="w-6 h-6 animate-spin text-primary" />;
      case "success":
        return <CheckCircle className="w-6 h-6 text-interview-success" />;
      case "error":
        return <XCircle className="w-6 h-6 text-destructive" />;
    }
  };

  const handleStartInterview = async () => {
    try {
      await document.documentElement.requestFullscreen();
      onComplete();
    } catch (error) {
      console.error("Fullscreen request failed:", error);
      onComplete();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mx-auto mb-4 flex items-center justify-center">
            <Monitor className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">System Check</h1>
          <p className="text-muted-foreground text-sm">
            Please ensure all requirements are met before starting the interview.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {/* Camera Check */}
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-foreground" />
              <div>
                <p className="font-medium text-foreground">Camera</p>
                {status.camera === "error" && (
                  <p className="text-xs text-destructive">{errorMessages.camera}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(status.camera)}
              {status.camera === "error" && (
                <Button variant="ghost" size="sm" onClick={() => retryCheck("camera")}>
                  Retry
                </Button>
              )}
            </div>
          </div>

          {/* Microphone Check */}
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
            <div className="flex items-center gap-3">
              <Mic className="h-5 w-5 text-foreground" />
              <div>
                <p className="font-medium text-foreground">Microphone</p>
                {status.microphone === "error" && (
                  <p className="text-xs text-destructive">{errorMessages.microphone}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(status.microphone)}
              {status.microphone === "error" && (
                <Button variant="ghost" size="sm" onClick={() => retryCheck("microphone")}>
                  Retry
                </Button>
              )}
            </div>
          </div>

          {/* Fullscreen Check */}
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5 text-foreground" />
              <div>
                <p className="font-medium text-foreground">Fullscreen Support</p>
                {status.fullscreen === "error" && (
                  <p className="text-xs text-destructive">{errorMessages.fullscreen}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(status.fullscreen)}
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-interview-warning/10 border border-interview-warning/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-interview-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm">Interview Rules</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                <li>• The interview will run in fullscreen mode</li>
                <li>• Tab switches and window resizing will be tracked</li>
                <li>• Your camera will record your responses</li>
                <li>• Exiting fullscreen may affect your results</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="hero"
            className="flex-1"
            onClick={handleStartInterview}
            disabled={!allPassed}
          >
            {allPassed ? "Start Interview" : "Checks Required"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SystemCheck;
