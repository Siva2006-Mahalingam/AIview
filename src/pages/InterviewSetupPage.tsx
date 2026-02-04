import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResumeUpload } from "@/components/ResumeUpload";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Briefcase, Code, Users, Sparkles } from "lucide-react";

const INTERVIEW_TYPES = [
  {
    id: "behavioral",
    title: "Behavioral",
    description: "STAR method questions about past experiences",
    icon: Users,
  },
  {
    id: "technical",
    title: "Technical",
    description: "Role-specific technical knowledge assessment",
    icon: Code,
  },
  {
    id: "case-study",
    title: "Case Study",
    description: "Problem-solving and analytical thinking",
    icon: Sparkles,
  },
  {
    id: "general",
    title: "General",
    description: "Mixed questions covering all areas",
    icon: Briefcase,
  },
];

export const InterviewSetupPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string>("");
  const [interviewType, setInterviewType] = useState<string>("");
  const [role, setRole] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    checkAuth();
  }, [navigate]);

  const handleResumeComplete = (id: string, text: string) => {
    setResumeId(id);
    setResumeText(text);
    setStep(2);
  };

  const handleStartInterview = async () => {
    if (!interviewType || !role || !userId) {
      toast.error("Please complete all fields");
      return;
    }

    setIsStarting(true);

    try {
      // Create interview session
      const { data: session, error } = await supabase
        .from("interview_sessions")
        .insert({
          user_id: userId,
          resume_id: resumeId,
          interview_type: interviewType,
          role: role,
          status: "in_progress",
        })
        .select()
        .single();

      if (error) throw error;

      // Navigate to interview with session data
      navigate(`/interview/${session.id}`, {
        state: {
          sessionId: session.id,
          interviewType,
          role,
          resumeText,
        },
      });
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to start interview. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Step 1: Resume Upload */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Upload Your Resume
              </h1>
              <p className="text-muted-foreground">
                We'll analyze your resume to generate personalized interview questions
              </p>
            </div>

            {userId && (
              <ResumeUpload userId={userId} onUploadComplete={handleResumeComplete} />
            )}

            <div className="mt-6 text-center">
              <Button variant="link" onClick={() => setStep(2)}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Interview Type */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Select Interview Type
              </h1>
              <p className="text-muted-foreground">
                Choose the type of interview you want to practice
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {INTERVIEW_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setInterviewType(type.id)}
                    className={`p-6 rounded-2xl border-2 text-left transition-all ${
                      interviewType === type.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{type.title}</h3>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!interviewType}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Role */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                What Role Are You Interviewing For?
              </h1>
              <p className="text-muted-foreground">
                Enter the job title or role you're preparing for
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Job Role</Label>
                <Input
                  id="role"
                  placeholder="e.g., Software Engineer, Product Manager, Data Analyst"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-14 text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  "Software Engineer",
                  "Product Manager",
                  "Data Scientist",
                  "UX Designer",
                  "Marketing Manager",
                  "Business Analyst",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setRole(suggestion)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      role === suggestion
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="hero"
                onClick={handleStartInterview}
                disabled={!role.trim() || isStarting}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Start Interview
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default InterviewSetupPage;
