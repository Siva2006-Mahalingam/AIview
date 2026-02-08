import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  Target,
  Trophy,
  Clock,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface SessionData {
  id: string;
  performance_percentage: number | null;
  ats_score: number | null;
  interview_type: string;
  started_at: string;
  ended_at: string | null;
}

interface QuestionData {
  id: string;
  score: number | null;
  question: string;
  feedback: string | null;
}

export const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const [sessionsRes, questionsRes] = await Promise.all([
        supabase
          .from("interview_sessions")
          .select("id, performance_percentage, ats_score, interview_type, started_at, ended_at")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("started_at", { ascending: true }),
        supabase
          .from("interview_questions")
          .select("id, score, question, feedback, session_id")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (questionsRes.data) setQuestions(questionsRes.data);
      setIsLoading(false);
    };

    fetchData();
  }, [navigate]);

  // Calculate stats
  const avgPerformance = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.performance_percentage || 0), 0) / sessions.length)
    : 0;

  const avgAts = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.ats_score || 0), 0) / sessions.length)
    : 0;

  const totalInterviews = sessions.length;

  const avgDuration = sessions.length > 0
    ? Math.round(
        sessions
          .filter((s) => s.ended_at)
          .reduce((sum, s) => {
            const duration = new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime();
            return sum + duration / 60000;
          }, 0) / sessions.filter((s) => s.ended_at).length
      )
    : 0;

  // Performance over time chart data
  const performanceData = sessions.map((s, idx) => ({
    name: `#${idx + 1}`,
    date: new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    performance: s.performance_percentage || 0,
    ats: s.ats_score || 0,
  }));

  // Interview types distribution
  const typeDistribution = sessions.reduce((acc, s) => {
    acc[s.interview_type] = (acc[s.interview_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeData = Object.entries(typeDistribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--interview-success))", "hsl(var(--interview-warning))"];

  // Score distribution
  const scoreRanges = { "90-100": 0, "70-89": 0, "50-69": 0, "0-49": 0 };
  questions.forEach((q) => {
    if (q.score === null) return;
    if (q.score >= 90) scoreRanges["90-100"]++;
    else if (q.score >= 70) scoreRanges["70-89"]++;
    else if (q.score >= 50) scoreRanges["50-69"]++;
    else scoreRanges["0-49"]++;
  });

  const scoreData = Object.entries(scoreRanges).map(([range, count]) => ({
    range,
    count,
  }));

  // Identify strengths and weaknesses (based on question keywords and scores)
  const keywordScores: Record<string, { total: number; count: number }> = {};
  questions.forEach((q) => {
    if (q.score === null) return;
    const keywords = ["teamwork", "leadership", "problem", "technical", "communication", "conflict", "experience", "project"];
    keywords.forEach((kw) => {
      if (q.question.toLowerCase().includes(kw)) {
        if (!keywordScores[kw]) keywordScores[kw] = { total: 0, count: 0 };
        keywordScores[kw].total += q.score;
        keywordScores[kw].count++;
      }
    });
  });

  const skillAnalysis = Object.entries(keywordScores)
    .map(([skill, data]) => ({
      skill: skill.charAt(0).toUpperCase() + skill.slice(1),
      avgScore: Math.round(data.total / data.count),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const strengths = skillAnalysis.filter((s) => s.avgScore >= 70).slice(0, 3);
  const weaknesses = skillAnalysis.filter((s) => s.avgScore < 70).slice(-3).reverse();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Analytics Dashboard</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Data Yet</h2>
            <p className="text-muted-foreground mb-6">
              Complete some interviews to see your analytics here.
            </p>
            <Button variant="hero" onClick={() => navigate("/interview-setup")}>
              Start Interview
            </Button>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{avgPerformance}%</p>
                <p className="text-sm text-muted-foreground">Avg Performance</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Target className="h-5 w-5 text-accent" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{avgAts}%</p>
                <p className="text-sm text-muted-foreground">Avg ATS Score</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-interview-success/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-interview-success" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{totalInterviews}</p>
                <p className="text-sm text-muted-foreground">Total Interviews</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-interview-warning/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-interview-warning" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{avgDuration}m</p>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Performance Over Time */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Performance Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="performance"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ats"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--accent))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Performance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-accent" />
                    <span className="text-muted-foreground">ATS Score</span>
                  </div>
                </div>
              </div>

              {/* Score Distribution */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Score Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={scoreData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Interview Types */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Interview Types</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {typeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Strengths */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="text-interview-success">💪</span> Strengths
                </h3>
                {strengths.length > 0 ? (
                  <div className="space-y-3">
                    {strengths.map((s) => (
                      <div key={s.skill} className="flex items-center justify-between">
                        <span className="text-foreground">{s.skill}</span>
                        <span className="text-sm font-medium text-interview-success">
                          {s.avgScore}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Complete more interviews to identify strengths
                  </p>
                )}
              </div>

              {/* Weaknesses */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="text-interview-warning">🎯</span> Areas to Improve
                </h3>
                {weaknesses.length > 0 ? (
                  <div className="space-y-3">
                    {weaknesses.map((s) => (
                      <div key={s.skill} className="flex items-center justify-between">
                        <span className="text-foreground">{s.skill}</span>
                        <span className="text-sm font-medium text-interview-warning">
                          {s.avgScore}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Great job! Keep practicing to maintain your skills
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AnalyticsPage;
