import { ArrowRight, Brain, MessageSquare, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  onStartInterview: () => void;
}

export const HeroSection = ({ onStartInterview }: HeroSectionProps) => {
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
          <span>AI-Powered Interview Practice</span>
        </div>

        {/* Main heading */}
        <h1 className="mb-6 max-w-4xl text-4xl font-bold leading-tight text-foreground animate-fade-in md:text-6xl lg:text-7xl" style={{ animationDelay: "0.1s" }}>
          Ace Your Next Interview with{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AI Coaching
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mb-10 max-w-2xl text-lg text-muted-foreground animate-fade-in md:text-xl" style={{ animationDelay: "0.2s" }}>
          Practice with our intelligent AI interviewer. Get real-time feedback, 
          personalized questions, and build confidence for your dream job.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col gap-4 sm:flex-row animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <Button variant="hero" size="xl" onClick={onStartInterview} className="group">
            Start Mock Interview
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button variant="outline" size="xl">
            Watch Demo
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="text-center">
            <div className="mb-2 text-3xl font-bold text-foreground md:text-4xl">10K+</div>
            <div className="text-sm text-muted-foreground">Interviews Practiced</div>
          </div>
          <div className="text-center">
            <div className="mb-2 text-3xl font-bold text-foreground md:text-4xl">95%</div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
          <div className="text-center">
            <div className="mb-2 text-3xl font-bold text-foreground md:text-4xl">50+</div>
            <div className="text-sm text-muted-foreground">Interview Types</div>
          </div>
        </div>
      </div>
    </section>
  );
};
