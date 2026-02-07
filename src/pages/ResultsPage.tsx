import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PdfExportButton } from "@/components/results/PdfExportButton";
import {
  ArrowLeft,
  Loader2,
  Trophy,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Home,
  RotateCcw,
} from "lucide-react";

interface QuestionFeedback {
  question_number: number;
  question: string;
  answer: string;
  score: number | null;
  feedback: string | null;
}

interface LocationState {
  qaData?: { question: string; answer: string; number: number }[];
  interviewType?: string;
  role?: string;
  duration?: number;
}

export const ResultsPage = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [isGenerating, setIsGenerating] = useState(true);
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [performancePercentage, setPerformancePercentage] = useState<number | null>(null);
  const [overallFeedback, setOverallFeedback] = useState<string | null>(null);
  const [improvements, setImprovements] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionFeedback[]>([]);
  const [expandedQuestions, setExpandedQuestions] = useState<number[]>([]);
  const [emotionSummary, setEmotionSummary] = useState<{
    avgConfidence: number;
    nervousCount: number;
    totalSnapshots: number;
  } | null>(null);

  useEffect(() => {
    const generateResults = async () => {
      if (!sessionId) {
        navigate("/dashboard");
        return;
      }

      setIsGenerating(true);

      try {
        // Fetch questions
        const { data: questionsData } = await supabase
          .from("interview_questions")
          .select("*")
          .eq("session_id", sessionId)
          .order("question_number");

        if (questionsData) {
          setQuestions(questionsData);
        }

        // Fetch emotion snapshots for summary
        const { data: emotionsData } = await supabase
          .from("emotion_snapshots")
          .select("*")
          .eq("session_id", sessionId);

        if (emotionsData && emotionsData.length > 0) {
          const avgConfidence =
            emotionsData.reduce((sum, e) => sum + (e.confidence_level || 0), 0) / emotionsData.length;
          const nervousCount = emotionsData.filter((e) => e.is_nervous).length;
          setEmotionSummary({
            avgConfidence: Math.round(avgConfidence),
            nervousCount,
            totalSnapshots: emotionsData.length,
          });
        }

        // Call edge function to generate comprehensive feedback
        const { data: feedbackData, error } = await supabase.functions.invoke("generate-feedback", {
          body: {
            sessionId,
            questions: questionsData || state?.qaData || [],
            interviewType: state?.interviewType,
            role: state?.role,
            duration: state?.duration,
            emotionData: emotionsData,
          },
        });

        if (error) throw error;

        // Update state with generated feedback
        setAtsScore(feedbackData.atsScore);
        setPerformancePercentage(feedbackData.performancePercentage);
        setOverallFeedback(feedbackData.overallFeedback);
        setImprovements(feedbackData.improvements);

        // Update questions with individual feedback
        if (feedbackData.questionFeedback) {
          setQuestions((prev) =>
            prev.map((q) => {
              const feedback = feedbackData.questionFeedback.find(
                (f: any) => f.questionNumber === q.question_number
              );
              return feedback
                ? { ...q, score: feedback.score, feedback: feedback.feedback }
                : q;
            })
          );
        }

        // Save to database
        await supabase
          .from("interview_sessions")
          .update({
            status: "completed",
            ats_score: feedbackData.atsScore,
            performance_percentage: feedbackData.performancePercentage,
            overall_feedback: feedbackData.overallFeedback,
            improvements: feedbackData.improvements,
            ended_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        // Update individual question scores
        if (feedbackData.questionFeedback) {
          for (const qf of feedbackData.questionFeedback) {
            await supabase
              .from("interview_questions")
              .update({ score: qf.score, feedback: qf.feedback })
              .eq("session_id", sessionId)
              .eq("question_number", qf.questionNumber);
          }
        }
      } catch (error) {
        console.error("Error generating feedback:", error);
        toast.error("Failed to generate feedback");
      } finally {
        setIsGenerating(false);
      }
    };

    generateResults();
  }, [sessionId, state, navigate]);

  const toggleQuestion = (qNum: number) => {
    setExpandedQuestions((prev) =>
      prev.includes(qNum) ? prev.filter((n) => n !== qNum) : [...prev, qNum]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-interview-success";
    if (score >= 60) return "text-interview-warning";
    return "text-destructive";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-interview-success/20";
    if (score >= 60) return "bg-interview-warning/20";
    return "bg-destructive/20";
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Analyzing Your Interview</h2>
          <p className="text-muted-foreground mb-4">
            Our AI is reviewing your responses and generating personalized feedback...
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="animate-pulse">✓ Evaluating answer quality</p>
            <p className="animate-pulse" style={{ animationDelay: "0.2s" }}>
              ✓ Calculating ATS score
            </p>
            <p className="animate-pulse" style={{ animationDelay: "0.4s" }}>
              ✓ Generating improvement suggestions
            </p>
          </div>
        </div>
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
          <div className="flex items-center gap-2">
            <PdfExportButton
              sessionData={{
                interviewType: state?.interviewType,
                role: state?.role,
                atsScore,
                performancePercentage,
                overallFeedback,
                improvements,
                questions,
                emotionSummary,
                date: new Date().toLocaleDateString(),
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Interview Complete! 🎉</h1>
          <p className="text-muted-foreground">
            {state?.interviewType?.charAt(0).toUpperCase() + state?.interviewType?.slice(1)} Interview
            for {state?.role}
          </p>
        </div>

        {/* Score Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {/* ATS Score */}
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mx-auto mb-4 flex items-center justify-center">
              <Trophy className="h-8 w-8 text-primary-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">ATS Score</p>
            <p className={`text-4xl font-bold ${getScoreColor(atsScore || 0)}`}>
              {atsScore ?? "-"}/100
            </p>
          </div>

          {/* Performance */}
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
              <Target className="h-8 w-8 text-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Performance</p>
            <p className={`text-4xl font-bold ${getScoreColor(performancePercentage || 0)}`}>
              {performancePercentage ?? "-"}%
            </p>
          </div>

          {/* Confidence */}
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Avg Confidence</p>
            <p className={`text-4xl font-bold ${getScoreColor(emotionSummary?.avgConfidence || 0)}`}>
              {emotionSummary?.avgConfidence ?? "-"}%
            </p>
            {emotionSummary && emotionSummary.nervousCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Nervous moments: {emotionSummary.nervousCount}/{emotionSummary.totalSnapshots}
              </p>
            )}
          </div>
        </div>

        {/* Overall Feedback */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-interview-success" />
            Overall Feedback
          </h2>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-foreground whitespace-pre-wrap">{overallFeedback || "No feedback available."}</p>
          </div>
        </section>

        {/* Improvements */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-interview-warning" />
            Areas for Improvement
          </h2>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-foreground whitespace-pre-wrap">{improvements || "No specific improvements identified."}</p>
          </div>
        </section>

        {/* Individual Question Feedback */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Question-by-Question Analysis</h2>
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.question_number} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleQuestion(q.question_number)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold ${
                        q.score ? getScoreBg(q.score) + " " + getScoreColor(q.score) : "bg-secondary text-foreground"
                      }`}
                    >
                      {q.score ?? "?"}
                    </span>
                    <span className="font-medium text-foreground">Question {q.question_number}</span>
                  </div>
                  {expandedQuestions.includes(q.question_number) ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>

                {expandedQuestions.includes(q.question_number) && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Question</h4>
                      <p className="text-foreground">{q.question}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Your Answer</h4>
                      <p className="text-foreground">{q.answer || "No answer provided"}</p>
                    </div>
                    {q.feedback && (
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-foreground mb-1">Feedback</h4>
                        <p className="text-muted-foreground text-sm">{q.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
            <Home className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button variant="hero" size="lg" onClick={() => navigate("/interview-setup")}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Practice Again
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ResultsPage;
