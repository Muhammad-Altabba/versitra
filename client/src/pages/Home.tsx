import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE } from "@/const";
import { Github, GitlabIcon as Gitlab, BookOpen, Languages, GitBranch } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleGitHubLogin = () => {
    window.location.href = "/api/oauth/github";
  };

  const handleGitLabLogin = () => {
    window.location.href = "/api/oauth/gitlab";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">{APP_TITLE}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Translate Books with Git
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            A minimal, distinctive platform for human translators to work section-by-section on books
            while relying entirely on Git for storage, versioning, and diff visualization.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <GitBranch className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Git-First Storage</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                All translations live in your own Git repositories. Full version control, complete ownership.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Languages className="h-10 w-10 text-purple-600 mb-2" />
              <CardTitle>AI-Assisted Translation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Smart document splitting and AI-generated drafts help you translate faster while maintaining quality.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BookOpen className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>Section-by-Section</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Work on manageable chunks with side-by-side editing and instant version diff visualization.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Login with your Git provider to start translating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleGitHubLogin}
                className="w-full"
                size="lg"
                variant="default"
              >
                <Github className="mr-2 h-5 w-5" />
                Continue with GitHub
              </Button>
              <Button
                onClick={handleGitLabLogin}
                className="w-full"
                size="lg"
                variant="outline"
              >
                <Gitlab className="mr-2 h-5 w-5" />
                Continue with GitLab
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t bg-white/80 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Git Translation Platform - MVP</p>
        </div>
      </footer>
    </div>
  );
}
