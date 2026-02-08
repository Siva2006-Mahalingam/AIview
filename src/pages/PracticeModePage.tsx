import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Mic,
  MicOff,
  SkipForward,
  RefreshCw,
  Lightbulb,
  Volume2,
  VolumeX,
} from "lucide-react";

const PRACTICE_QUESTIONS = {
  behavioral: [
    "Tell me about a time you had to deal with a difficult team member.",
    "Describe a situation where you had to meet a tight deadline.",
    "Give an example of when you showed leadership.",
    "Tell me about a mistake you made and what you learned from it.",
    "Describe a time when you had to adapt to change quickly.",
  ],
  technical: [
    "Explain a complex technical concept in simple terms.",
    "Describe your approach to debugging a difficult problem.",
    "How do you stay updated with new technologies?",
    "Tell me about a technical project you're proud of.",
    "How do you handle technical disagreements with teammates?",
  ],
  general: [
    "Why are you interested in this role?",
    "What are your greatest strengths?",
    "Where do you see yourself in 5 years?",
    "Why should we hire you?",
    "What motivates you in your work?",
  ],
};

export const PracticeModePage = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState<"behavioral" | "technical" | "general" | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showTip, setShowTip] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Speech Recognition API (with browser prefixes)
  function getSpeechRecognition() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    return win.SpeechRecognition || win.webkitSpeechRecognition || null;
  }

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  const startCategory = (cat: "behavioral" | "technical" | "general") => {
    setCategory(cat);
    setQuestionIndex(0);
    setTranscript("");
    setShowTip(false);
    const questions = PRACTICE_QUESTIONS[cat];
    setCurrentQuestion(questions[0]);
  };

  const nextQuestion = () => {
    if (!category) return;
    const questions = PRACTICE_QUESTIONS[category];
    const nextIdx = (questionIndex + 1) % questions.length;
    setQuestionIndex(nextIdx);
    setCurrentQuestion(questions[nextIdx]);
    setTranscript("");
    setShowTip(false);
    stopListening();
  };

  const shuffleQuestion = () => {
    if (!category) return;
    const questions = PRACTICE_QUESTIONS[category];
    const randomIdx = Math.floor(Math.random() * questions.length);
    setQuestionIndex(randomIdx);
    setCurrentQuestion(questions[randomIdx]);
    setTranscript("");
    setShowTip(false);
  };

  const speakQuestion = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(currentQuestion);
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const getTip = () => {
    const tips: Record<string, string[]> = {
      behavioral: [
        "Use the STAR method: Situation, Task, Action, Result",
        "Be specific with numbers and outcomes when possible",
        "Focus on YOUR contribution, not the team's",
        "Keep your answer to 2-3 minutes",
      ],
      technical: [
        "Start with the high-level concept before diving into details",
        "Use analogies to explain complex topics",
        "Admit when you don't know something, but explain how you'd find out",
        "Discuss trade-offs in your technical decisions",
      ],
      general: [
        "Research the company beforehand and reference it",
        "Be authentic - interviewers can tell when you're not genuine",
        "Have 2-3 specific examples ready to share",
        "Ask thoughtful questions at the end",
      ],
    };

    return tips[category || "general"][Math.floor(Math.random() * tips[category || "general"].length)];
  };

  if (!category) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-lg font-semibold text-foreground">Practice Mode</h1>
            <div className="w-24" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Quick Practice</h2>
            <p className="text-muted-foreground">
              Warm up with common interview questions. No recording, no scoring — just practice!
            </p>
          </div>

          <div className="grid gap-4">
            <button
              onClick={() => startCategory("behavioral")}
              className="bg-card border border-border rounded-2xl p-6 text-left hover:shadow-lg transition-all group"
            >
              <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                🎭 Behavioral Questions
              </h3>
              <p className="text-muted-foreground">
                Practice STAR method responses about teamwork, leadership, and challenges
              </p>
            </button>

            <button
              onClick={() => startCategory("technical")}
              className="bg-card border border-border rounded-2xl p-6 text-left hover:shadow-lg transition-all group"
            >
              <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                💻 Technical Questions
              </h3>
              <p className="text-muted-foreground">
                Explain concepts, discuss projects, and practice technical communication
              </p>
            </button>

            <button
              onClick={() => startCategory("general")}
              className="bg-card border border-border rounded-2xl p-6 text-left hover:shadow-lg transition-all group"
            >
              <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                🎯 General Questions
              </h3>
              <p className="text-muted-foreground">
                Classic interview questions about motivation, goals, and qualifications
              </p>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setCategory(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-foreground capitalize">{category} Practice</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Question Card */}
        <div className="bg-card border border-border rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Question {questionIndex + 1} of {PRACTICE_QUESTIONS[category].length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={speakQuestion}
            >
              {isSpeaking ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          </div>

          <h2 className="text-2xl font-semibold text-foreground mb-6">
            {currentQuestion}
          </h2>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={shuffleQuestion}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Shuffle
            </Button>
            <Button variant="outline" size="sm" onClick={nextQuestion}>
              <SkipForward className="h-4 w-4 mr-2" />
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTip(!showTip)}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Tip
            </Button>
          </div>
        </div>

        {/* Tip Card */}
        {showTip && (
          <div className="bg-interview-warning/10 border border-interview-warning/30 rounded-xl p-4 mb-6 animate-fade-in">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-interview-warning shrink-0 mt-0.5" />
              <p className="text-foreground">{getTip()}</p>
            </div>
          </div>
        )}

        {/* Voice Input Area */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Your Answer</h3>
            <Button
              variant={isListening ? "destructive" : "default"}
              size="sm"
              onClick={isListening ? stopListening : startListening}
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Start Speaking
                </>
              )}
            </Button>
          </div>

          <div className={`min-h-[150px] rounded-xl p-4 transition-colors ${
            isListening ? "bg-primary/10 border-2 border-primary" : "bg-secondary"
          }`}>
            {isListening && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm text-muted-foreground">Listening...</span>
              </div>
            )}
            
            {transcript ? (
              <p className="text-foreground">{transcript}</p>
            ) : (
              <p className="text-muted-foreground text-center mt-12">
                {isListening
                  ? "Speak your answer..."
                  : "Click 'Start Speaking' to practice your answer out loud"}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-muted-foreground text-sm">
            💡 Practice mode doesn't record or save anything — it's just for warm-up!
          </p>
        </div>
      </main>
    </div>
  );
};

export default PracticeModePage;
