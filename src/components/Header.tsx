import { MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onStartInterview?: () => void;
}

export const Header = ({ onStartInterview }: HeaderProps) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">InterviewAI</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            How it Works
          </a>
        </nav>

        <Button variant="hero" size="sm" onClick={onStartInterview} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Start Interview
        </Button>
      </div>
    </header>
  );
};
