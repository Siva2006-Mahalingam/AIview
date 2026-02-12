import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Mic, MicOff, Send, User, Volume2, VolumeX, Video, VideoOff, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraPreview, CameraPreviewRef } from "@/components/CameraPreview";
import { SystemCheck } from "@/components/SystemCheck";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useVideoRecorder } from "@/hooks/useVideoRecorder";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import EnvHealthBanner from "@/components/EnvHealthBanner";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  questionNumber?: number;
}

interface EmotionData {
  is_nervous: boolean;
  confidence_level: number;
  emotions: Record<string, number>;
}

interface LocationState {
  sessionId: string;
  interviewType: string;
  role: string;
  resumeText: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-chat`;

export const InterviewPage = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [showSystemCheck, setShowSystemCheck] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [questionCount, setQuestionCount] = useState(0);
  const [currentEmotions, setCurrentEmotions] = useState<EmotionData | null>(null);
  const [interviewDuration, setInterviewDuration] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [antiCheatWarnings, setAntiCheatWarnings] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingTranscript = useRef("");
  const startTimeRef = useRef(Date.now());
  const qaRef = useRef<{ question: string; answer: string; number: number; videoUrl?: string }[]>([]);
  const cameraRef = useRef<CameraPreviewRef>(null);
  const recognitionRef = useRef<any>(null);

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    getUser();
  }, [navigate]);

  // Anti-cheat tracking
  useAntiCheat({
    sessionId: sessionId || "",
    isActive: !showSystemCheck && !isInitializing,
    onFullscreenExit: () => {
      setAntiCheatWarnings((prev) => prev + 1);
    },
  });

  // Video recorder (records each answer and stores a path per question)
  const videoRecorder = useVideoRecorder({
    sessionId: sessionId || "",
    userId: userId || "",
  });

  const startRecordingForQuestion = useCallback(
    (questionNumber: number) => {
      if (!cameraEnabled || !userId) return;

      const attempt = (retries: number) => {
        const stream = cameraRef.current?.getStream();
        if (stream) {
          videoRecorder.startRecording(questionNumber, stream);
          return;
        }
        if (retries > 0) {
          setTimeout(() => attempt(retries - 1), 300);
        }
      };

      attempt(10);
    },
    [cameraEnabled, userId, videoRecorder]
  );

  const stopAndSaveRecording = useCallback(
    async (questionNumber: number) => {
      console.log("stopAndSaveRecording: attempting to stop recording for Q", questionNumber);
      const videoRef = await videoRecorder.stopRecording();
      
      if (!videoRef) {
        console.log("stopAndSaveRecording: no videoRef returned (was not recording or upload failed)");
        return;
      }

      console.log("stopAndSaveRecording: video uploaded to", videoRef);

      // Save storage path into the question row
      const { error } = await supabase
        .from("interview_questions")
        .update({ video_url: videoRef })
        .eq("session_id", sessionId)
        .eq("question_number", questionNumber);

      if (error) {
        console.error("stopAndSaveRecording: failed to save video_url", error);
      } else {
        console.log("stopAndSaveRecording: video_url saved for Q", questionNumber);
      }

      const lastQa = qaRef.current[qaRef.current.length - 1];
      if (lastQa?.number === questionNumber) {
        lastQa.videoUrl = videoRef;
      }
    },
    [sessionId, videoRecorder]
  );

  useEffect(() => {
    if (!cameraEnabled || !userId) {
      videoRecorder.cancelRecording();
    }
  }, [cameraEnabled, userId, videoRecorder]);

  // Track interview duration
  useEffect(() => {
    if (showSystemCheck) return;
    const timer = setInterval(() => {
      setInterviewDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [showSystemCheck]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Preload voices for Web Speech API (some browsers load them async)
  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Text-to-speech using Web Speech API (free, built into browsers)
  const speakText = useCallback((text: string) => {
    if (!voiceEnabled || !text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    setIsSpeaking(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get available voices and prefer a natural-sounding English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Natural'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // Speech-to-text using Web Speech API (free, built into browsers)
  const startListening = useCallback(() => {
    try {
      // Stop any ongoing speech before listening
      window.speechSynthesis.cancel();
      setIsSpeaking(false);

      // Check browser support
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error("Speech recognition not supported in this browser");
        return;
      }

      // Create recognition instance
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput(prev => prev + finalTranscript);
          pendingTranscript.current = '';
        } else if (interimTranscript) {
          pendingTranscript.current = interimTranscript;
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error !== 'no-speech') {
          toast.error("Voice recognition error");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        // Only update state if we're still supposed to be listening
        if (recognitionRef.current === recognition) {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      toast.success("Listening... Speak now!");
    } catch (error) {
      console.error("STT error:", error);
      toast.error("Failed to start voice input");
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } catch {
      // Ignore stop errors
    }
    setIsListening(false);

    const transcript = input.trim() || pendingTranscript.current.trim();
    if (transcript) {
      setInput(transcript);
      pendingTranscript.current = '';
      setTimeout(() => {
        const sendBtn = document.getElementById("send-btn");
        if (sendBtn) sendBtn.click();
      }, 300);
    }
  }, [input]);

  // Ensure we always release devices on unmount (route change, refresh, etc.)
  useEffect(() => {
    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
      } catch {
        // ignore
      }

      try {
        videoRecorder.cancelRecording();
      } catch {
        // ignore
      }

      cameraRef.current
        ?.getStream()
        ?.getTracks()
        .forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle emotion capture - wrapped in useCallback to prevent camera re-render
  const handleEmotionCaptured = useCallback((emotions: EmotionData) => {
    setCurrentEmotions(emotions);
  }, []);

  // Stream AI response
  const streamResponse = async (response: Response, questionNumber: number): Promise<string> => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    setMessages((prev) => [...prev, { role: "assistant", content: "", questionNumber: questionNumber }]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            setQuestionCount(questionNumber);
            return assistantContent;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  questionNumber: questionNumber,
                };
                return updated;
              });
            }
          } catch (parseError) {
            // Log but continue - might be incomplete JSON chunk
            console.warn("JSON parse warning:", parseError);
            continue;
          }
        }
      }
    } catch (streamError) {
      console.error("Stream error:", streamError);
    }

    setQuestionCount(questionNumber);
    return assistantContent;
  };

  // Initialize interview
  useEffect(() => {
    if (showSystemCheck) return; // Wait for system check to complete
    
    const initInterview = async () => {
      if (!sessionId || !state) {
        navigate("/dashboard");
        return;
      }

      startTimeRef.current = Date.now();
      setIsInitializing(true);
      try {
        const response = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [],
            interviewType: state.interviewType,
            role: state.role,
            resumeText: state.resumeText,
            isInit: true,
          }),
        });

        if (!response.ok || !response.body) throw new Error("Failed to start interview");

        const fullResponse = await streamResponse(response, 1);

        // Store question
        if (sessionId && fullResponse) {
          await supabase.from("interview_questions").insert({
            session_id: sessionId,
            question_number: 1,
            question: fullResponse,
          });
          qaRef.current.push({ question: fullResponse, answer: "", number: 1 });

          // Start recording the answer for Q1
          startRecordingForQuestion(1);
        }

        if (voiceEnabled && fullResponse) await speakText(fullResponse);
      } catch (error) {
        console.error("Init error:", error);
        toast.error("Failed to start interview");
      } finally {
        setIsInitializing(false);
      }
    };

    initInterview();
  }, [sessionId, state, speakText, voiceEnabled, navigate, showSystemCheck]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    // Stop and save video for the previous question
    const lastQuestionNumber = qaRef.current[qaRef.current.length - 1]?.number;
    if (lastQuestionNumber) {
      await stopAndSaveRecording(lastQuestionNumber);
    }

    // Save user's answer to previous question
    if (qaRef.current.length > 0) {
      const lastQa = qaRef.current[qaRef.current.length - 1];
      lastQa.answer = userMessage;

      try {
        await supabase
          .from("interview_questions")
          .update({ answer: userMessage })
          .eq("session_id", sessionId)
          .eq("question_number", lastQa.number);
      } catch (dbError) {
        console.error("Failed to save answer:", dbError);
      }
    }

    try {
      // Build conversation history for the API (only role and content)
      const conversationHistory = messages
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));
      
      conversationHistory.push({ role: "user", content: userMessage });

      console.log("Sending to chat API:", { messages: conversationHistory.length });

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: conversationHistory,
          interviewType: state?.interviewType,
          role: state?.role,
          resumeText: state?.resumeText,
        }),
      });

      console.log("Chat API response status:", response.status);

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        console.error("Chat API error:", response.status, errorText);
        throw new Error("Failed to send message");
      }

      // Calculate next question number BEFORE streaming
      const nextQuestionNumber = qaRef.current.length + 1;
      const fullResponse = await streamResponse(response, nextQuestionNumber);
      console.log("Streamed response length:", fullResponse.length);

      // Store new question using qaRef length as source of truth
      if (sessionId && fullResponse) {
        try {
          await supabase.from("interview_questions").insert({
            session_id: sessionId,
            question_number: nextQuestionNumber,
            question: fullResponse,
          });
          qaRef.current.push({ question: fullResponse, answer: "", number: nextQuestionNumber });
          console.log("Stored question:", nextQuestionNumber);

          // Start recording the answer for the new question
          startRecordingForQuestion(nextQuestionNumber);
        } catch (dbError) {
          console.error("Failed to save question:", dbError);
        }
      }

      if (voiceEnabled && fullResponse) await speakText(fullResponse);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEndInterview = async () => {
    try {
      // Stop speech synthesis
      window.speechSynthesis.cancel();
      setIsSpeaking(false);

      // Stop listening (microphone)
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }
        setIsListening(false);
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }

      // Stop and save any in-progress recording
      try {
        const lastQuestionNumber = qaRef.current[qaRef.current.length - 1]?.number;
        if (lastQuestionNumber) {
          await stopAndSaveRecording(lastQuestionNumber);
        }
        videoRecorder.cancelRecording();
      } catch (e) {
        console.error("Error stopping recording:", e);
      }

      // Hard-stop camera tracks
      try {
        cameraRef.current
          ?.getStream()
          ?.getTracks()
          .forEach((t) => t.stop());
      } catch (e) {
        console.error("Error stopping camera:", e);
      }

      // Exit fullscreen if active
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
      } catch (e) {
        console.error("Error exiting fullscreen:", e);
      }
    } finally {
      // Navigate to results with Q&A data
      navigate(`/results/${sessionId}`, {
        state: {
          qaData: qaRef.current,
          interviewType: state?.interviewType,
          role: state?.role,
          duration: interviewDuration,
        },
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Show system check first
  if (showSystemCheck) {
    return (
      <SystemCheck
        onComplete={() => setShowSystemCheck(false)}
        onCancel={() => navigate("/dashboard")}
      />
    );
  }

  return (
    <div className="flex h-screen bg-interview-bg">
      {/* Sidebar with camera */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Camera View */}
        <div className="p-4">
          <div className="aspect-video rounded-xl overflow-hidden bg-secondary mb-4">
            {cameraEnabled && sessionId ? (
              <CameraPreview
                ref={cameraRef}
                sessionId={sessionId}
                isActive={cameraEnabled}
                captureInterval={120000}
                onEmotionCaptured={handleEmotionCaptured}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <VideoOff className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <Button
            variant={cameraEnabled ? "outline" : "secondary"}
            size="sm"
            className="w-full"
            onClick={() => setCameraEnabled(!cameraEnabled)}
          >
            {cameraEnabled ? (
              <>
                <Video className="h-4 w-4 mr-2" />
                Camera On
              </>
            ) : (
              <>
                <VideoOff className="h-4 w-4 mr-2" />
                Camera Off
              </>
            )}
          </Button>
        </div>

        {/* Emotion Status */}
        {currentEmotions && (
          <div className="px-4 pb-4">
            <div className="bg-secondary/50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Confidence Level</h4>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    currentEmotions.confidence_level > 70
                      ? "bg-interview-success"
                      : currentEmotions.confidence_level > 40
                      ? "bg-interview-warning"
                      : "bg-destructive"
                  }`}
                  style={{ width: `${currentEmotions.confidence_level}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentEmotions.is_nervous ? "You seem nervous. Take a deep breath!" : "Looking confident!"}
              </p>
            </div>
          </div>
        )}

        {/* Anti-cheat warnings */}
        {antiCheatWarnings > 0 && (
          <div className="px-4 pb-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {antiCheatWarnings} warning{antiCheatWarnings > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Fullscreen exits and tab switches are being tracked.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium text-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatTime(interviewDuration)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">Questions</span>
            <span className="font-medium text-foreground">{questionCount}</span>
          </div>
        </div>

        {/* End Button */}
        <div className="p-4 border-t border-border">
          <Button variant="destructive" className="w-full" onClick={handleEndInterview}>
            End Interview
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleEndInterview}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                End
              </Button>
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-sm font-semibold text-foreground">
                  {state?.interviewType?.charAt(0).toUpperCase() + state?.interviewType?.slice(1)} Interview
                </h1>
                <p className="text-xs text-muted-foreground">{state?.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isSpeaking) {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                  }
                  setVoiceEnabled(!voiceEnabled);
                }}
                className={voiceEnabled ? "text-primary" : "text-muted-foreground"}
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <div className="flex items-center gap-2">
                {isSpeaking && <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />}
                {isListening && <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />}
                <span className="text-xs text-muted-foreground">
                  {isSpeaking ? "AI Speaking..." : isListening ? "Listening..." : "AI Ready"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Show environment health (missing API keys) */}
        <EnvHealthBanner />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {isInitializing && messages.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Preparing your interview...</p>
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 animate-fade-in ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <span className="text-xs font-semibold">AI</span>
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border shadow-sm"
                  }`}
                >
                  {message.role === "assistant" && message.questionNumber && (
                    <span className="text-xs text-muted-foreground mb-1 block">
                      Question {message.questionNumber}
                    </span>
                  )}
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{message.content || "..."}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <span className="text-xs font-semibold">AI</span>
                </div>
                <div className="rounded-2xl bg-card border border-border px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3">
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={isListening ? stopListening : startListening}
                disabled={isLoading || isInitializing || isSpeaking}
                className={`h-12 w-12 rounded-xl shrink-0 ${isListening ? "animate-pulse" : ""}`}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>

              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? "Listening..." : "Type or speak your answer..."}
                  rows={1}
                  className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  style={{ maxHeight: "150px" }}
                  disabled={isLoading || isInitializing || isListening}
                />
              </div>

              <Button
                id="send-btn"
                variant="interview"
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || isInitializing}
                className="h-12 w-12 rounded-xl shrink-0"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              🎤 Click mic to speak • Enter to send • AI will respond with voice
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;
