import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AntiCheatOptions {
  sessionId: string;
  isActive: boolean;
  onFullscreenExit?: () => void;
}

export const useAntiCheat = ({ sessionId, isActive, onFullscreenExit }: AntiCheatOptions) => {
  const tabSwitchesRef = useRef(0);
  const windowResizesRef = useRef(0);
  const fullscreenExitsRef = useRef(0);
  const lastResizeTimeRef = useRef(0);

  const updateDatabase = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      await supabase
        .from("interview_sessions")
        .update({
          tab_switches: tabSwitchesRef.current,
          window_resizes: windowResizesRef.current,
          fullscreen_exits: fullscreenExitsRef.current,
        })
        .eq("id", sessionId);
    } catch (error) {
      console.error("Failed to update anti-cheat data:", error);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!isActive) return;

    // Track tab visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchesRef.current += 1;
        toast.warning("Tab switch detected. This will be recorded.", {
          duration: 3000,
        });
        updateDatabase();
      }
    };

    // Track window blur (switching to another app)
    const handleBlur = () => {
      tabSwitchesRef.current += 1;
      toast.warning("Window focus lost. This will be recorded.", {
        duration: 3000,
      });
      updateDatabase();
    };

    // Track window resize (debounced)
    const handleResize = () => {
      const now = Date.now();
      if (now - lastResizeTimeRef.current > 1000) {
        windowResizesRef.current += 1;
        lastResizeTimeRef.current = now;
        updateDatabase();
      }
    };

    // Track fullscreen exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        fullscreenExitsRef.current += 1;
        toast.error("Fullscreen exited. Please return to fullscreen mode.", {
          duration: 5000,
          action: {
            label: "Re-enter",
            onClick: () => {
              document.documentElement.requestFullscreen().catch(console.error);
            },
          },
        });
        updateDatabase();
        onFullscreenExit?.();
      }
    };

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isActive, updateDatabase, onFullscreenExit]);

  const getStats = useCallback(() => ({
    tabSwitches: tabSwitchesRef.current,
    windowResizes: windowResizesRef.current,
    fullscreenExits: fullscreenExitsRef.current,
  }), []);

  return { getStats };
};

export default useAntiCheat;
