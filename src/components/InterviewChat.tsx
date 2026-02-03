import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, Mic, MicOff, Send, User, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InterviewChatProps {
  interviewType: string;
  role: string;
  onEnd: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-chat`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

export const InterviewChat = ({ interviewType, role, onEnd }: InterviewChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingTranscript = useRef("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Text-to-speech function
  const speakText = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return;

    setIsSpeaking(true);
    try {
      const response = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text, voiceId: "JBFqnCBsd6RMkjVDRZzb" }),
      });

      if (!response.ok) {
        throw new Error("TTS failed");
      }

      const data = await response.json();
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      
      await audio.play();
    } catch (error) {
      console.error("TTS error:", error);
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  // Speech-to-text using ElevenLabs useScribe
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      pendingTranscript.current = data.text;
      setInput(data.text);
    },
    onCommittedTranscript: (data) => {
      if (data.text.trim()) {
        setInput(data.text);
        pendingTranscript.current = "";
      }
    },
  });

  const startListening = useCallback(async () => {
    try {
      // Stop any current audio
      if (audioRef.current) {
        audioRef.current.pause();
        setIsSpeaking(false);
      }

      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      
      if (error || !data?.token) {
        throw new Error("Failed to get scribe token");
      }

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      
      setIsListening(true);
      toast.success("Listening... Speak now!");
    } catch (error) {
      console.error("STT error:", error);
      toast.error("Failed to start voice input. Please check microphone permissions.");
    }
  }, [scribe]);

  const stopListening = useCallback(() => {
    scribe.disconnect();
    setIsListening(false);
    
    // Auto-send if there's content
    const transcript = input.trim() || pendingTranscript.current.trim();
    if (transcript) {
      setInput(transcript);
      // Trigger send after a brief delay
      setTimeout(() => {
        const sendBtn = document.getElementById("send-btn");
        if (sendBtn) sendBtn.click();
      }, 300);
    }
  }, [scribe, input]);

  // Stream AI response
  const streamResponse = async (response: Response): Promise<string> => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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
        if (jsonStr === "[DONE]") break;

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
              };
              return updated;
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    return assistantContent;
  };

  // Initialize interview
  useEffect(() => {
    const initInterview = async () => {
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
            interviewType,
            role,
            isInit: true,
          }),
        });

        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
          return;
        }
        if (response.status === 402) {
          toast.error("Payment required. Please add credits.");
          return;
        }
        if (!response.ok || !response.body) {
          throw new Error("Failed to start interview");
        }

        const fullResponse = await streamResponse(response);
        
        // Speak the first message
        if (voiceEnabled && fullResponse) {
          await speakText(fullResponse);
        }
      } catch (error) {
        console.error("Init error:", error);
        toast.error("Failed to start interview. Please try again.");
      } finally {
        setIsInitializing(false);
      }
    };

    initInterview();
  }, [interviewType, role, speakText, voiceEnabled]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          interviewType,
          role,
        }),
      });

      if (response.status === 429) {
        toast.error("Rate limit exceeded. Please try again later.");
        return;
      }
      if (response.status === 402) {
        toast.error("Payment required. Please add credits.");
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error("Failed to send message");
      }

      const fullResponse = await streamResponse(response);
      
      // Speak the response
      if (voiceEnabled && fullResponse) {
        await speakText(fullResponse);
      }
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

  const toggleVoice = () => {
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
    setVoiceEnabled(!voiceEnabled);
    toast.info(voiceEnabled ? "Voice output disabled" : "Voice output enabled");
  };

  return (
    <div className="flex h-screen flex-col bg-interview-bg">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onEnd}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              End Interview
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">
                {interviewType.charAt(0).toUpperCase() + interviewType.slice(1)} Interview
              </h1>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleVoice}
              className={voiceEnabled ? "text-primary" : "text-muted-foreground"}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-2">
              {isSpeaking && (
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
              {isListening && (
                <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
              )}
              <span className="text-xs text-muted-foreground">
                {isSpeaking ? "AI Speaking..." : isListening ? "Listening..." : "AI Ready"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="container mx-auto max-w-3xl space-y-6">
          {isInitializing && messages.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Preparing your interview...
                </p>
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
        <div className="container mx-auto max-w-3xl">
          <div className="flex items-end gap-3">
            {/* Voice input button */}
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading || isInitializing || isSpeaking}
              className={`h-12 w-12 rounded-xl shrink-0 ${isListening ? "animate-pulse" : ""}`}
            >
              {isListening ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
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
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            🎤 Click mic to speak • Enter to send • AI will respond with voice
          </p>
        </div>
      </div>
    </div>
  );
};
