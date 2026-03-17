import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QuestionVideoDialog } from "@/components/history/QuestionVideoDialog";
import { VideoThumbnail } from "@/components/history/VideoThumbnail";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  Trophy,
  Target,
  ChevronRight,
  MessageSquare,
} from "lucide-react";

interface InterviewSession {
  id: string;
  interview_type: string;
  role: string;
  status: string;
  ats_score: number | null;
  performance_percentage: number | null;
  started_at: string;
  ended_at: string | null;
  tab_switches: number | null;
  window_resizes: number | null;
  fullscreen_exits: number | null;
}

interface InterviewQuestion {
  id: string;
  session_id: string;
  question_number: number;
  question: string;
  answer: string | null;
  score: number | null;
  feedback: string | null;
  video_url: string | null;
}

export const HistoryPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<Record<string, InterviewQuestion[]>>({});
  const [loadingQuestions, setLoadingQuestions] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("interview_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });

      if (error) {
        console.error("Error fetching sessions:", error);
      } else {
        setSessions(data || []);
      }

      setIsLoading(false);
    };

    fetchSessions();
  }, [navigate]);

  const fetchSessionQuestions = async (sessionId: string) => {
    if (sessionQuestions[sessionId]) {
      setExpandedSession(expandedSession === sessionId ? null : sessionId);
      return;
    }

    setLoadingQuestions(sessionId);
    
    const { data, error } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("session_id", sessionId)
      .order("question_number");

    if (!error && data) {
      setSessionQuestions((prev) => ({ ...prev, [sessionId]: data }));
    }

    setLoadingQuestions(null);
    setExpandedSession(sessionId);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 80) return "text-interview-success";
    if (score >= 60) return "text-interview-warning";
    return "text-destructive";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "In Progress";
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    return `${minutes} min`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Interview History</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Interview History</h2>
            <p className="text-muted-foreground mb-6">
              Start your first practice interview to see your history here.
            </p>
            <Button variant="hero" onClick={() => navigate("/interview-setup")}>
              Start Interview
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Session Header */}
                <button
                  onClick={() => fetchSessionQuestions(session.id)}
                  className="w-full p-6 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {session.interview_type.charAt(0).toUpperCase() + session.interview_type.slice(1)} Interview
                        </h3>
                        <p className="text-sm text-muted-foreground">{session.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Scores */}
                      <div className="text-right hidden md:block">
                        <div className="flex items-center gap-4">
                          {session.ats_score !== null && (
                            <div className="flex items-center gap-1">
                              <Target className="h-4 w-4 text-muted-foreground" />
                              <span className={`font-semibold ${getScoreColor(session.ats_score)}`}>
                                {session.ats_score}%
                              </span>
                            </div>
                          )}
                          {session.performance_percentage !== null && (
                            <div className="flex items-center gap-1">
                              <Trophy className="h-4 w-4 text-muted-foreground" />
                              <span className={`font-semibold ${getScoreColor(session.performance_percentage)}`}>
                                {session.performance_percentage}%
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDuration(session.started_at, session.ended_at)}
                        </p>
                      </div>

                      {/* Date & Status */}
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {formatDate(session.started_at)}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                            session.status === "completed"
                              ? "bg-interview-success/20 text-interview-success"
                              : "bg-interview-warning/20 text-interview-warning"
                          }`}
                        >
                          {session.status === "completed" ? "Completed" : "In Progress"}
                        </span>
                      </div>

                      <ChevronRight
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          expandedSession === session.id ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Anti-cheat stats */}
                  {session.status === "completed" && (
                    <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                      <span>Tab switches: {session.tab_switches ?? 0}</span>
                      <span>Resizes: {session.window_resizes ?? 0}</span>
                      <span>Fullscreen exits: {session.fullscreen_exits ?? 0}</span>
                    </div>
                  )}
                </button>

                {/* Expanded Questions */}
                {expandedSession === session.id && (
                  <div className="border-t border-border p-6 bg-secondary/20">
                    {loadingQuestions === session.id ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : sessionQuestions[session.id]?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No questions recorded for this session.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/results/${session.id}`)}
                          >
                            View Full Results
                          </Button>
                        </div>

                        {sessionQuestions[session.id]?.map((q) => (
                          <div key={q.id} className="bg-card rounded-xl p-4 border border-border">
                            <div className="flex items-start justify-between gap-4">
                              {/* Video Thumbnail */}
                              {q.video_url && (
                                <QuestionVideoDialog
                                  videoRef={q.video_url}
                                  title={`Question ${q.question_number} – Answer video`}
                                  trigger={
                                    <VideoThumbnail
                                      videoRef={q.video_url}
                                    />
                                  }
                                />
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                                    q.score ? (q.score >= 70 ? "bg-interview-success/20 text-interview-success" : "bg-interview-warning/20 text-interview-warning") : "bg-secondary text-muted-foreground"
                                  }`}>
                                    Q{q.question_number} {q.score ? `• ${q.score}%` : ""}
                                  </span>
                                </div>
                                <p className="font-medium text-foreground text-sm mb-2">
                                  {q.question}
                                </p>
                                {q.answer && (
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                                    {q.answer}
                                  </p>
                                )}
                                {q.feedback && (
                                  <p className="text-xs text-muted-foreground mt-2 italic whitespace-pre-wrap break-words">
                                    {q.feedback}
                                  </p>
                                )}
                              </div>

                              {/* Play button (fallback for no thumbnail) */}
                              {q.video_url && (
                                <div className="hidden">
                                  <QuestionVideoDialog
                                    videoRef={q.video_url}
                                    title={`Question ${q.question_number} – Answer video`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HistoryPage;
