import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  Users,
} from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avgScore: number;
  totalInterviews: number;
  isCurrentUser: boolean;
}

export const LeaderboardPage = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<"week" | "month" | "all">("month");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Calculate date filter
      let dateFilter = new Date();
      if (timeFrame === "week") {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (timeFrame === "month") {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      } else {
        dateFilter = new Date(0); // All time
      }

      // Fetch all completed sessions
      const { data: sessions, error } = await supabase
        .from("interview_sessions")
        .select("user_id, performance_percentage")
        .eq("status", "completed")
        .gte("started_at", dateFilter.toISOString())
        .not("performance_percentage", "is", null);

      if (error) {
        console.error("Error fetching leaderboard:", error);
        setIsLoading(false);
        return;
      }

      // Aggregate by user
      const userAggregates: Record<string, { total: number; count: number }> = {};
      sessions?.forEach((s) => {
        if (!userAggregates[s.user_id]) {
          userAggregates[s.user_id] = { total: 0, count: 0 };
        }
        userAggregates[s.user_id].total += s.performance_percentage || 0;
        userAggregates[s.user_id].count++;
      });

      // Fetch profiles for all user_ids in one query
      const userIds = Object.keys(userAggregates);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
      profiles?.forEach((p) => {
        profileMap[p.user_id] = { full_name: p.full_name, email: p.email };
      });

      const getDisplayName = (userId: string, fallbackIdx: number): string => {
        if (userId === user.id) {
          const name = profileMap[userId]?.full_name?.trim();
          return name ? `${name} (You)` : "You";
        }
        const name = profileMap[userId]?.full_name?.trim();
        if (name) return name;
        // Mask email for privacy: show only first part before @
        const email = profileMap[userId]?.email;
        if (email) {
          const localPart = email.split("@")[0];
          return localPart.length > 3
            ? `${localPart.slice(0, 2)}${"*".repeat(localPart.length - 2)}`
            : localPart;
        }
        return `Interviewer #${fallbackIdx + 1}`;
      };

      // Create leaderboard with real names
      const entries: LeaderboardEntry[] = Object.entries(userAggregates)
        .map(([userId, data], idx) => ({
          rank: 0,
          displayName: getDisplayName(userId, idx),
          avgScore: Math.round(data.total / data.count),
          totalInterviews: data.count,
          isCurrentUser: userId === user.id,
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      // Get current user's position
      const currentUserEntry = entries.find((e) => e.isCurrentUser);
      setUserStats(currentUserEntry || null);

      // Show top 20
      setLeaderboard(entries.slice(0, 20));
      setIsLoading(false);
    };

    fetchLeaderboard();
  }, [navigate, timeFrame]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-interview-warning" />;
      case 2:
        return <Medal className="h-5 w-5 text-muted-foreground" />;
      case 3:
        return <Medal className="h-5 w-5 text-accent" />;
      default:
        return <span className="text-muted-foreground font-medium">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return "bg-primary/10 border-primary";
    switch (rank) {
      case 1:
        return "bg-interview-warning/10 border-interview-warning/30";
      case 2:
        return "bg-muted/50 border-muted-foreground/30";
      case 3:
        return "bg-accent/10 border-accent/30";
      default:
        return "bg-card border-border";
    }
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Leaderboard</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Time Frame Selector */}
        <div className="flex justify-center gap-2 mb-8">
          {(["week", "month", "all"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFrame === tf
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              {tf === "week" ? "This Week" : tf === "month" ? "This Month" : "All Time"}
            </button>
          ))}
        </div>

        {/* User Stats Card */}
        {userStats && (
          <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-6 mb-8 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-foreground/80 text-sm mb-1">Your Ranking</p>
                <p className="text-4xl font-bold">#{userStats.rank}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-primary-foreground/80 text-sm">Avg Score</p>
                    <p className="text-2xl font-bold">{userStats.avgScore}%</p>
                  </div>
                  <div>
                    <p className="text-primary-foreground/80 text-sm">Interviews</p>
                    <p className="text-2xl font-bold">{userStats.totalInterviews}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Rankings Yet</h2>
            <p className="text-muted-foreground mb-6">
              Complete interviews to appear on the leaderboard.
            </p>
            <Button variant="hero" onClick={() => navigate("/interview-setup")}>
              Start Interview
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${getRankBg(
                  entry.rank,
                  entry.isCurrentUser
                )}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>
                  <div>
                    <p className={`font-semibold ${entry.isCurrentUser ? "text-primary" : "text-foreground"}`}>
                      {entry.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.totalInterviews} interview{entry.totalInterviews !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-interview-success" />
                  <span className="text-lg font-bold text-foreground">{entry.avgScore}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Motivation Footer */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            🎯 Complete more interviews with higher scores to climb the ranks!
          </p>
        </div>
      </main>
    </div>
  );
};

export default LeaderboardPage;
