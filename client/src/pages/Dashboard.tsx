import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { APP_TITLE } from "@/const";
import { BookOpen, Plus, LogOut, Github, GitlabIcon as Gitlab, Loader2, GitBranch, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  
  // Handle OAuth callback messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    
    if (connected) {
      toast.success(`Successfully connected to ${connected === 'github' ? 'GitHub' : 'GitLab'}!`);
      refetchGitInfo();
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
    
    if (error) {
      toast.error(decodeURIComponent(error));
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("es");

  const { data: books, isLoading: booksLoading, refetch } = trpc.books.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: gitInfo, refetch: refetchGitInfo } = trpc.git.getUserInfo.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createRepoMutation = trpc.git.createRepo.useMutation();
  const createBookMutation = trpc.books.create.useMutation();
  const deleteBookMutation = trpc.books.delete.useMutation();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleteRepo, setDeleteRepo] = useState(true);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleCreateBook = async () => {
    if (!repoName || !bookTitle) return;

    try {
      // Create Git repository
      const repo = await createRepoMutation.mutateAsync({
        name: repoName,
        description: `Translation project: ${bookTitle}`,
        isPrivate: true,
      });

      // Create book record
      await createBookMutation.mutateAsync({
        repoName: repo.name,
        repoUrl: repo.url,
        title: bookTitle,
        sourceLanguage,
        targetLanguage,
      });

      // Reset form and close dialog
      setRepoName("");
      setBookTitle("");
      setIsCreateDialogOpen(false);
      refetch();
      toast.success("Project created successfully!");
    } catch (error) {
      console.error("Failed to create book:", error);
      toast.error("Failed to create project");
    }
  };

  const handleDeleteBook = async () => {
    if (!bookToDelete) return;

    try {
      await deleteBookMutation.mutateAsync({
        id: bookToDelete.id,
        deleteRepo,
      });

      setDeleteDialogOpen(false);
      setBookToDelete(null);
      refetch();
      toast.success(deleteRepo ? "Project and repository deleted" : "Project deleted (repository kept)");
    } catch (error) {
      console.error("Failed to delete book:", error);
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">{APP_TITLE}</h1>
            </div>
            <div className="flex items-center gap-4">
              {gitInfo ? (
                <div className="flex items-center gap-2 text-sm">
                  {gitInfo.provider === "github" ? (
                    <Github className="h-4 w-4 text-green-600" />
                  ) : (
                    <Gitlab className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-green-600 font-medium">{gitInfo.username}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = '/api/oauth/github'}
                  >
                    <Github className="h-4 w-4 mr-2" />
                    Connect GitHub
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = '/api/oauth/gitlab'}
                  >
                    <Gitlab className="h-4 w-4 mr-2" />
                    Connect GitLab
                  </Button>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Git Connection Alert */}
        {!gitInfo && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="rounded-full bg-yellow-100 p-2">
                    <GitBranch className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 mb-1">Connect Your Git Account</h3>
                  <p className="text-sm text-yellow-800 mb-4">
                    To create translation projects, you need to connect your GitHub or GitLab account.
                    This allows the platform to create repositories in your account for storing translations.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.location.href = '/api/oauth/github'}
                      size="sm"
                    >
                      <Github className="h-4 w-4 mr-2" />
                      Connect GitHub
                    </Button>
                    <Button
                      onClick={() => window.location.href = '/api/oauth/gitlab'}
                      size="sm"
                      variant="outline"
                    >
                      <Gitlab className="h-4 w-4 mr-2" />
                      Connect GitLab
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">My Translation Projects</h2>
            <p className="text-muted-foreground mt-1">
              Manage your book translation projects
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!gitInfo}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Translation Project</DialogTitle>
                <DialogDescription>
                  Create a new Git repository for your book translation project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="repo-name">Repository Name</Label>
                  <Input
                    id="repo-name"
                    placeholder="my-book-translation"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="book-title">Book Title</Label>
                  <Input
                    id="book-title"
                    placeholder="The Great Gatsby"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="source-lang">Source Language</Label>
                    <Input
                      id="source-lang"
                      placeholder="en"
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target-lang">Target Language</Label>
                    <Input
                      id="target-lang"
                      placeholder="es"
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateBook}
                  disabled={!repoName || !bookTitle || createRepoMutation.isPending || createBookMutation.isPending}
                >
                  {(createRepoMutation.isPending || createBookMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Books Grid */}
        {booksLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : books && books.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <Card key={book.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {book.title || book.repoName}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookToDelete({ id: book.id, title: book.title || book.repoName });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    {book.sourceLanguage} → {book.targetLanguage}
                  </CardDescription>
                </CardHeader>
                <CardContent
                  className="cursor-pointer"
                  onClick={() => setLocation(`/book/${book.id}`)}
                >
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Repository: {book.repoName}</p>
                    <p>Last modified: {new Date(book.lastModified || book.createdAt || "").toLocaleDateString()}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first translation project to get started
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!gitInfo}>
              <Plus className="h-4 w-4 mr-2" />
              {gitInfo ? 'Create Your First Project' : 'Connect Git Account First'}
            </Button>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{bookToDelete?.title}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="delete-repo"
                checked={deleteRepo}
                onChange={(e) => setDeleteRepo(e.target.checked)}
                className="mt-1"
              />
              <div>
                <label htmlFor="delete-repo" className="text-sm font-medium cursor-pointer">
                  Also delete Git repository
                </label>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete the repository from {gitInfo?.provider === 'github' ? 'GitHub' : 'GitLab'}.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Warning: This action is permanent and cannot be undone!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setBookToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBook}
              disabled={deleteBookMutation.isPending}
            >
              {deleteBookMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete {deleteRepo ? 'Project & Repository' : 'Project Only'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

