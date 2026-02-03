import { Brain, Clock, LineChart, MessageCircle, Shield, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Questions",
    description: "Dynamic questions tailored to your role and experience level",
  },
  {
    icon: MessageCircle,
    title: "Real-time Feedback",
    description: "Get instant insights on your responses and areas for improvement",
  },
  {
    icon: Clock,
    title: "Practice Anytime",
    description: "24/7 availability to practice whenever you're ready",
  },
  {
    icon: LineChart,
    title: "Track Progress",
    description: "Monitor your improvement over time with detailed analytics",
  },
  {
    icon: Zap,
    title: "Industry Specific",
    description: "Questions customized for tech, finance, healthcare, and more",
  },
  {
    icon: Shield,
    title: "Safe Environment",
    description: "Practice without pressure in a judgment-free space",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="bg-secondary/30 py-24">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Everything You Need to Succeed
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Our AI interviewer adapts to your needs, providing a realistic and 
            helpful practice experience.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="group border-border/50 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
