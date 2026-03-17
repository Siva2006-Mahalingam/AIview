import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LogOut, Plus, FileText, History, User, ArrowRight, Loader2, BarChart3, Trophy, Zap, Shield, Save } from "lucide-react";

// Admin email allowlist
const ADMIN_EMAILS = ["231001203@rajalakshmi.edu.in"];

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  target_role: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  bio: string | null;
}

interface ProfileFormState {
  full_name: string;
  phone: string;
  target_role: string;
  years_experience: string;
  linkedin_url: string;
  bio: string;
}

interface Resume {
  id: string;
  original_filename: string;
  uploaded_at: string;
  ocr_text: string | null;
}

interface InterviewSession {
  id: string;
  interview_type: string;
  role: string;
  status: string;
  ats_score: number | null;
  performance_percentage: number | null;
  started_at: string;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    full_name: "",
    phone: "",
    target_role: "",
    years_experience: "",
    linkedin_url: "",
    bio: "",
  });
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData);
          setProfileForm({
            full_name: profileData.full_name ?? "",
            phone: profileData.phone ?? "",
            target_role: profileData.target_role ?? "",
            years_experience: profileData.years_experience?.toString() ?? "",
            linkedin_url: profileData.linkedin_url ?? "",
            bio: profileData.bio ?? "",
          });
        }

        // Fetch resumes
        const { data: resumesData } = await supabase
          .from("resumes")
          .select("*")
          .eq("user_id", user.id)
          .order("uploaded_at", { ascending: false });

        if (resumesData) {
          setResumes(resumesData);
        }

        // Fetch interview sessions
        const { data: sessionsData } = await supabase
          .from("interview_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(10);

        if (sessionsData) {
          setSessions(sessionsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
    toast.success("Signed out successfully");
  };

  const handleStartInterview = () => {
    navigate("/interview-setup");
  };

  const handleProfileFieldChange = (field: keyof ProfileFormState, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const yearsInput = profileForm.years_experience.trim();
      let parsedYearsExperience: number | null = null;
      if (yearsInput) {
        const parsedValue = Number(yearsInput);
        if (!Number.isInteger(parsedValue) || parsedValue < 0) {
          toast.error("Years of experience must be a non-negative whole number");
          return;
        }
        parsedYearsExperience = parsedValue;
      }

      const profilePayload = {
        full_name: profileForm.full_name.trim() || null,
        phone: profileForm.phone.trim() || null,
        target_role: profileForm.target_role.trim() || null,
        years_experience: parsedYearsExperience,
        linkedin_url: profileForm.linkedin_url.trim() || null,
        bio: profileForm.bio.trim() || null,
        email: profile?.email ?? user.email ?? null,
      };

      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            ...profilePayload,
          },
          { onConflict: "user_id" }
        )
        .select("*")
        .single();

      if (error) throw error;

      setProfile(updatedProfile);
      setProfileForm({
        full_name: updatedProfile.full_name ?? "",
        phone: updatedProfile.phone ?? "",
        target_role: updatedProfile.target_role ?? "",
        years_experience: updatedProfile.years_experience?.toString() ?? "",
        linkedin_url: updatedProfile.linkedin_url ?? "",
        bio: updatedProfile.bio ?? "",
      });

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: profilePayload.full_name,
          phone: profilePayload.phone,
          target_role: profilePayload.target_role,
          years_experience: profilePayload.years_experience,
          linkedin_url: profilePayload.linkedin_url,
          bio: profilePayload.bio,
        },
      });

      if (metadataError) {
        console.warn("Profile updated but auth metadata sync failed:", metadataError.message);
      }

      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save profile");
    } finally {
      setIsSavingProfile(false);
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
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">AI</span>
            </div>
            <span className="font-semibold text-foreground">InterviewAI</span>
          </div>
          <div className="flex items-center gap-4">
            {profile?.email && ADMIN_EMAILS.includes(profile.email) && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {profile?.full_name || profile?.email || "User"}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {profile?.full_name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-muted-foreground">
            Ready for your next interview practice session?
          </p>
        </div>

        {/* Profile Settings */}
        <section className="mb-8 bg-card border border-border rounded-2xl p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Profile Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Keep your interview profile details updated.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-full-name">Full Name</Label>
              <Input
                id="profile-full-name"
                value={profileForm.full_name}
                onChange={(e) => handleProfileFieldChange("full_name", e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone Number</Label>
              <Input
                id="profile-phone"
                value={profileForm.phone}
                onChange={(e) => handleProfileFieldChange("phone", e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-target-role">Target Role</Label>
              <Input
                id="profile-target-role"
                value={profileForm.target_role}
                onChange={(e) => handleProfileFieldChange("target_role", e.target.value)}
                placeholder="Frontend Developer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-years-experience">Years of Experience</Label>
              <Input
                id="profile-years-experience"
                type="number"
                min={0}
                step={1}
                value={profileForm.years_experience}
                onChange={(e) => handleProfileFieldChange("years_experience", e.target.value)}
                placeholder="2"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="profile-linkedin">LinkedIn URL</Label>
              <Input
                id="profile-linkedin"
                type="url"
                value={profileForm.linkedin_url}
                onChange={(e) => handleProfileFieldChange("linkedin_url", e.target.value)}
                placeholder="https://linkedin.com/in/your-name"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="profile-bio">Short Bio</Label>
              <Textarea
                id="profile-bio"
                value={profileForm.bio}
                onChange={(e) => handleProfileFieldChange("bio", e.target.value)}
                placeholder="Share your background, strengths, and interview goals"
                className="min-h-24"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </section>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <button
            onClick={handleStartInterview}
            className="group bg-gradient-to-br from-primary to-accent p-6 rounded-2xl text-left hover:shadow-glow transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                <Plus className="h-6 w-6 text-primary-foreground" />
              </div>
              <ArrowRight className="h-5 w-5 text-primary-foreground opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-semibold text-primary-foreground mb-1">
              Start Interview
            </h3>
            <p className="text-primary-foreground/80 text-sm">
              Full practice with scoring & recording
            </p>
          </button>

          <button
            onClick={() => navigate("/practice")}
            className="group bg-card border border-border p-6 rounded-2xl text-left hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-interview-warning/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-interview-warning" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-1">
              Practice Mode
            </h3>
            <p className="text-muted-foreground text-sm">
              Quick warm-up without recording
            </p>
          </button>

          <button
            onClick={() => navigate("/history")}
            className="group bg-card border border-border p-6 rounded-2xl text-left hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                <History className="h-6 w-6 text-foreground" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-1">
              View History
            </h3>
            <p className="text-muted-foreground text-sm">
              Review past interviews
            </p>
          </button>

          <button
            onClick={() => navigate("/analytics")}
            className="group bg-card border border-border p-6 rounded-2xl text-left hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-1">
              Analytics
            </h3>
            <p className="text-muted-foreground text-sm">
              Track performance trends
            </p>
          </button>

          <button
            onClick={() => navigate("/leaderboard")}
            className="group bg-card border border-border p-6 rounded-2xl text-left hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-interview-success/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-interview-success" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-1">
              Leaderboard
            </h3>
            <p className="text-muted-foreground text-sm">
              Compare your ranking
            </p>
          </button>
        </div>

        {/* Recent Resumes */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Your Resumes</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/interview-setup")}>
              <Plus className="h-4 w-4 mr-2" />
              Upload New
            </Button>
          </div>

          {resumes.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No resumes uploaded yet. Upload your resume to start practicing.
              </p>
              <Button onClick={() => navigate("/interview-setup")}>
                Upload Resume
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumes.slice(0, 3).map((resume) => (
                <div
                  key={resume.id}
                  className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {resume.original_filename}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(resume.uploaded_at).toLocaleDateString()}
                      </p>
                      {resume.ocr_text && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-interview-success/20 text-interview-success mt-2">
                          Parsed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Interviews */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Interviews</h2>
            {sessions.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
                View All
              </Button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No interview sessions yet. Start your first practice interview!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  onClick={() => navigate(`/results/${session.id}`)}
                  className="w-full bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {session.interview_type.charAt(0).toUpperCase() + session.interview_type.slice(1)} Interview
                      </p>
                      <p className="text-sm text-muted-foreground">{session.role}</p>
                    </div>
                    <div className="text-right">
                      {session.status === "completed" && session.performance_percentage ? (
                        <div className="text-lg font-semibold text-interview-success">
                          {session.performance_percentage}%
                        </div>
                      ) : (
                        <span className={`text-sm px-2 py-1 rounded ${
                          session.status === "in_progress" 
                            ? "bg-interview-warning/20 text-interview-warning"
                            : "bg-secondary text-muted-foreground"
                        }`}>
                          {session.status === "in_progress" ? "In Progress" : session.status}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(session.started_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
