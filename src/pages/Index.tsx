import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const handleStartSetup = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onStartInterview={handleStartSetup} />
      <HeroSection onStartInterview={handleStartSetup} />
      <FeaturesSection />
    </div>
  );
};

export default Index;
