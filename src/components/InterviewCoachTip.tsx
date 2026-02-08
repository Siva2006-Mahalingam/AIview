import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InterviewCoachTipProps {
  question: string;
  answer: string;
  isVisible: boolean;
  onClose: () => void;
}

export const InterviewCoachTip = ({
  question,
  answer,
  isVisible,
  onClose,
}: InterviewCoachTipProps) => {
  const [tip, setTip] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isVisible || !answer || answer.length < 20) {
      setTip(null);
      return;
    }

    const generateTip = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("interview-coach", {
          body: { question, answer },
        });

        if (error) throw error;
        setTip(data?.tip || null);
      } catch (e) {
        console.error("Failed to get coaching tip:", e);
        setTip(null);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(generateTip, 1000);
    return () => clearTimeout(debounce);
  }, [question, answer, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 right-4 w-80 bg-card border border-border rounded-2xl shadow-xl p-4 animate-fade-in z-40">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-interview-warning/20 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-interview-warning" />
          </div>
          <h4 className="font-semibold text-foreground text-sm">AI Coach</h4>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Analyzing...</span>
        </div>
      ) : tip ? (
        <p className="text-sm text-foreground leading-relaxed">{tip}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Keep speaking! I'll provide tips as you answer.
        </p>
      )}
    </div>
  );
};

export default InterviewCoachTip;
