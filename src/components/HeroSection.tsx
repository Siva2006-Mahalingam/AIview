import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Brain, FileText, Camera, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface HeroSectionProps {
  onStartInterview: () => void;
}

export const HeroSection = ({ onStartInterview }: HeroSectionProps) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);

  const handleStart = () => {
    if (isAuthenticated) {
      navigate("/interview-setup");
    } else {
      navigate("/auth");
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden pt-16">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[var(--gradient-hero)]" />
      
      {/* Decorative elements */}
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />

      <div className="container relative mx-auto flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary animate-fade-in">
          <Brain className="h-4 w-4" />
          <span>3rd Round Interview Preparation</span>
        </div>

        {/* Main heading */}
        <h1 className="mb-6 max-w-4xl text-4xl font-bold leading-tight text-foreground animate-fade-in md:text-6xl lg:text-7xl" style={{ animationDelay: "0.1s" }}>
          Master Your{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Final Interview
          </span>{" "}
          Round
        </h1>

        {/* Subtitle */}
        <p className="mb-10 max-w-2xl text-lg text-muted-foreground animate-fade-in md:text-xl" style={{ animationDelay: "0.2s" }}>
          Upload your resume, practice with AI-powered voice interviews, 
          get real-time emotion analysis, and receive detailed ATS scoring & feedback.
        </p>

        {/* Key Features Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10 animate-fade-in" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            <span>Resume OCR Analysis</span>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm">
            <Camera className="h-4 w-4 text-primary" />
            <span>Emotion Detection</span>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>ATS Score & Feedback</span>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-4 sm:flex-row animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <Button variant="hero" size="xl" onClick={handleStart} className="group">
            {isAuthenticated ? "Start Interview" : "Get Started Free"}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          {isAuthenticated && (
            <Button variant="outline" size="xl" onClick={() => navigate("/dashboard")}>
              View Dashboard
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="text-center">
            <div className="mb-2 text-3xl font-bold text-foreground md:text-4xl">🎯</div>
            <div className="text-sm text-muted-foreground">Resume-Based Questions</div>
          </div>
          <div className="text-center">
            <div className="mb-2 text-3xl font-bold text-foreground md:text-4xl">🎤</div>
            <div className="text-sm text-muted-foreground">Voice-to-Voice Interview</div>
          </div>
          <div className="text-center">
            <div className="mb-2 text-3xl font-bold text-foreground md:text-4xl">📊</div>
            <div className="text-sm text-muted-foreground">Detailed Analytics</div>
          </div>
        </div>
      </div>
    </section>
  );
};
