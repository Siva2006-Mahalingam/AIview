import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { InterviewSetup } from "@/components/InterviewSetup";
import { InterviewChat } from "@/components/InterviewChat";

type AppState = "landing" | "setup" | "interview";

interface InterviewConfig {
  type: string;
  role: string;
}

const Index = () => {
  const [appState, setAppState] = useState<AppState>("landing");
  const [interviewConfig, setInterviewConfig] = useState<InterviewConfig | null>(null);

  const handleStartSetup = () => {
    setAppState("setup");
  };

  const handleStartInterview = (type: string, role: string) => {
    setInterviewConfig({ type, role });
    setAppState("interview");
  };

  const handleEndInterview = () => {
    setAppState("landing");
    setInterviewConfig(null);
  };

  const handleBackToLanding = () => {
    setAppState("landing");
  };

  if (appState === "interview" && interviewConfig) {
    return (
      <InterviewChat
        interviewType={interviewConfig.type}
        role={interviewConfig.role}
        onEnd={handleEndInterview}
      />
    );
  }

  if (appState === "setup") {
    return (
      <InterviewSetup
        onStart={handleStartInterview}
        onBack={handleBackToLanding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onStartInterview={handleStartSetup} />
      <HeroSection onStartInterview={handleStartSetup} />
      <FeaturesSection />
    </div>
  );
};

export default Index;
