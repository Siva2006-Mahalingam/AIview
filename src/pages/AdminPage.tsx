import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Users,
  MessageSquare,
  Trophy,
  AlertTriangle,
  Shield,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// Admin email allowlist - stored in env or hardcoded for now
const ADMIN_EMAILS = ["admin@interviewai.com"]; // Add your admin emails here

interface UserStats {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  sessions_count: number;
  avg_score: number | null;
}

interface SessionDetails {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  interview_type: string;
  role: string;
  status: string;
  ats_score: number | null;
  performance_percentage: number | null;
  started_at: string;
  tab_switches: number | null;
  fullscreen_exits: number | null;
}

export const AdminPage = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [sessions, setSessions] = useState<SessionDetails[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "sessions">("sessions");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSessions: 0,
    avgScore: 0,
    suspiciousSessions: 0,
  });

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user email is in admin allowlist
      if (!ADMIN_EMAILS.includes(user.email || "")) {
        toast.error("Access denied. You are not an admin.");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      await fetchData();
    };

    checkAdminAndFetch();
  }, [navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all sessions with user info
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("interview_sessions")
        .select("*")
        .order("started_at", { ascending: false });

      if (sessionsError) throw sessionsError;

      // Calculate user stats
      const userStatsMap = new Map<string, UserStats>();
      
      for (const profile of profiles || []) {
        const userSessions = sessionsData?.filter((s) => s.user_id === profile.user_id) || [];
        const completedSessions = userSessions.filter((s) => s.status === "completed");
        const avgScore = completedSessions.length > 0
          ? completedSessions.reduce((sum, s) => sum + (s.performance_percentage || 0), 0) / completedSessions.length
          : null;

        userStatsMap.set(profile.user_id, {
          id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          created_at: profile.created_at,
          sessions_count: userSessions.length,
          avg_score: avgScore ? Math.round(avgScore) : null,
        });
      }

      setUsers(Array.from(userStatsMap.values()));

      // Process sessions with user info
      const processedSessions: SessionDetails[] = (sessionsData || []).map((session) => {
        const userInfo = userStatsMap.get(session.user_id);
        return {
          ...session,
          user_email: userInfo?.email || null,
          user_name: userInfo?.full_name || null,
        };
      });

      setSessions(processedSessions);

      // Calculate overall stats
      const completedSessions = sessionsData?.filter((s) => s.status === "completed") || [];
      const suspiciousSessions = sessionsData?.filter(
        (s) => (s.tab_switches || 0) > 3 || (s.fullscreen_exits || 0) > 2
      ) || [];

      setStats({
        totalUsers: profiles?.length || 0,
        totalSessions: sessionsData?.length || 0,
        avgScore: completedSessions.length > 0
          ? Math.round(
              completedSessions.reduce((sum, s) => sum + (s.performance_percentage || 0), 0) /
                completedSessions.length
            )
          : 0,
        suspiciousSessions: suspiciousSessions.length,
      });
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 80) return "text-interview-success";
    if (score >= 60) return "text-interview-warning";
    return "text-destructive";
  };

  if (isAdmin === null || isLoading) {
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Admin Panel</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Users className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <MessageSquare className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
            <p className="text-sm text-muted-foreground">Total Sessions</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Trophy className="h-6 w-6 text-interview-success mx-auto mb-2" />
            <p className="text-2xl font-bold text-interview-success">{stats.avgScore}%</p>
            <p className="text-sm text-muted-foreground">Avg. Score</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <AlertTriangle className="h-6 w-6 text-interview-warning mx-auto mb-2" />
            <p className="text-2xl font-bold text-interview-warning">{stats.suspiciousSessions}</p>
            <p className="text-sm text-muted-foreground">Suspicious</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "sessions" ? "default" : "outline"}
            onClick={() => setActiveTab("sessions")}
          >
            Sessions
          </Button>
          <Button
            variant={activeTab === "users" ? "default" : "outline"}
            onClick={() => setActiveTab("users")}
          >
            Users
          </Button>
        </div>

        {/* Sessions Table */}
        {activeTab === "sessions" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-foreground">User</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Type</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Role</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Score</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Tab Switches</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-secondary/30 cursor-pointer"
                      onClick={() => navigate(`/results/${session.id}`)}
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {session.user_name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">{session.user_email}</p>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground capitalize">{session.interview_type}</td>
                      <td className="p-4 text-sm text-foreground">{session.role}</td>
                      <td className="p-4">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            session.status === "completed"
                              ? "bg-interview-success/20 text-interview-success"
                              : "bg-interview-warning/20 text-interview-warning"
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className={`p-4 text-sm font-medium ${getScoreColor(session.performance_percentage)}`}>
                        {session.performance_percentage ?? "-"}%
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-sm ${
                            (session.tab_switches || 0) > 3 ? "text-destructive font-medium" : "text-foreground"
                          }`}
                        >
                          {session.tab_switches ?? 0}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(session.started_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Table */}
        {activeTab === "users" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Name</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Email</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Sessions</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Avg. Score</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-secondary/30">
                      <td className="p-4 text-sm font-medium text-foreground">
                        {user.full_name || "Unknown"}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{user.email}</td>
                      <td className="p-4 text-sm text-foreground">{user.sessions_count}</td>
                      <td className={`p-4 text-sm font-medium ${getScoreColor(user.avg_score)}`}>
                        {user.avg_score ?? "-"}%
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
