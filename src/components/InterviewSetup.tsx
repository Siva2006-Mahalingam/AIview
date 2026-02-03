import { useState } from "react";
import { ArrowRight, Briefcase, Code, Lightbulb, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const interviewTypes = [
  {
    id: "behavioral",
    icon: Users,
    title: "Behavioral",
    description: "Questions about past experiences and soft skills",
    examples: ["Tell me about yourself", "Describe a challenging situation"],
  },
  {
    id: "technical",
    icon: Code,
    title: "Technical",
    description: "Role-specific technical questions and problem-solving",
    examples: ["System design", "Coding concepts", "Technical scenarios"],
  },
  {
    id: "case",
    icon: Lightbulb,
    title: "Case Study",
    description: "Business problems and strategic thinking exercises",
    examples: ["Market analysis", "Problem decomposition"],
  },
  {
    id: "general",
    icon: Briefcase,
    title: "General",
    description: "Common interview questions for any role",
    examples: ["Strengths & weaknesses", "Career goals"],
  },
];

interface InterviewSetupProps {
  onStart: (type: string, role: string) => void;
  onBack: () => void;
}

export const InterviewSetup = ({ onStart, onBack }: InterviewSetupProps) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [role, setRole] = useState("");

  const handleStart = () => {
    if (selectedType && role.trim()) {
      onStart(selectedType, role.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-12">
        <button
          onClick={onBack}
          className="mb-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Home
        </button>

        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <h1 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Set Up Your Interview
            </h1>
            <p className="text-muted-foreground">
              Choose your interview type and tell us about the role you're preparing for.
            </p>
          </div>

          {/* Role Input */}
          <div className="mb-8">
            <label className="mb-2 block text-sm font-medium text-foreground">
              What role are you interviewing for?
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g., Software Engineer, Product Manager, Data Analyst..."
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Interview Type Selection */}
          <div className="mb-8">
            <label className="mb-4 block text-sm font-medium text-foreground">
              Select Interview Type
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              {interviewTypes.map((type) => (
                <Card
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`cursor-pointer border-2 transition-all duration-200 ${
                    selectedType === type.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                          selectedType === type.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        <type.icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-semibold text-foreground">{type.title}</h3>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {type.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {type.examples.map((example) => (
                        <span
                          key={example}
                          className="rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            onClick={handleStart}
            disabled={!selectedType || !role.trim()}
          >
            Start Interview
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
