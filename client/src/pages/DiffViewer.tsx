import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { APP_TITLE } from "@/const";
import { BookOpen, ArrowLeft, GitCommit, Loader2, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import ReactMarkdown from "react-markdown";

export default function DiffViewer() {
  const { bookId } = useParams<{ bookId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [baseCommit, setBaseCommit] = useState<string>("");
  const [headCommit, setHeadCommit] = useState<string>("");

  const { data: book } = trpc.books.get.useQuery(
    { id: bookId || "" },
    { enabled: !!bookId && isAuthenticated }
  );

  const { data: commits, isLoading: commitsLoading } = trpc.git.getCommitHistory.useQuery(
    {
      owner: book?.repoName.split("/")[0] || "",
      repo: book?.repoName.split("/")[1] || book?.repoName || "",
      limit: 50,
    },
    { enabled: !!book }
  );

  const { data: diffData, isLoading: diffLoading } = trpc.git.getDiff.useQuery(
    {
      owner: book?.repoName.split("/")[0] || "",
      repo: book?.repoName.split("/")[1] || book?.repoName || "",
      base: baseCommit,
      head: headCommit,
    },
    { enabled: !!book && !!baseCommit && !!headCommit }
  );

  // Parse diff data into a more readable format
  const parsedDiff = useMemo(() => {
    if (!diffData) return null;

    const lines = diffData.split("\n");
    const changes: Array<{ type: "add" | "remove" | "context"; content: string }> = [];

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        changes.push({ type: "add", content: line.substring(1) });
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        changes.push({ type: "remove", content: line.substring(1) });
      } else if (!line.startsWith("@@") && !line.startsWith("diff") && !line.startsWith("index")) {
        changes.push({ type: "context", content: line });
      }
    }

    return changes;
  }, [diffData]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please login to view diffs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation(`/book/${bookId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-lg font-bold">{book?.title || book?.repoName}</h1>
                  <p className="text-sm text-muted-foreground">Version History & Diffs</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Commit History Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCommit className="h-5 w-5" />
                  Commit History
                </CardTitle>
                <CardDescription>Select two commits to compare</CardDescription>
              </CardHeader>
              <CardContent>
                {commitsLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : commits && commits.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Base Commit</label>
                      <Select value={baseCommit} onValueChange={setBaseCommit}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select base commit" />
                        </SelectTrigger>
                        <SelectContent>
                          {commits.map((commit: any) => (
                            <SelectItem key={commit.sha} value={commit.sha}>
                              <div className="flex flex-col">
                                <span className="font-mono text-xs">{commit.sha.substring(0, 7)}</span>
                                <span className="text-sm">{commit.message.split("\n")[0]}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Head Commit</label>
                      <Select value={headCommit} onValueChange={setHeadCommit}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select head commit" />
                        </SelectTrigger>
                        <SelectContent>
                          {commits.map((commit: any) => (
                            <SelectItem key={commit.sha} value={commit.sha}>
                              <div className="flex flex-col">
                                <span className="font-mono text-xs">{commit.sha.substring(0, 7)}</span>
                                <span className="text-sm">{commit.message.split("\n")[0]}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-medium mb-3">Recent Commits</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {commits.map((commit: any) => (
                          <div
                            key={commit.sha}
                            className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => {
                              if (!baseCommit) {
                                setBaseCommit(commit.sha);
                              } else if (!headCommit) {
                                setHeadCommit(commit.sha);
                              }
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <GitCommit className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{commit.message.split("\n")[0]}</p>
                                <p className="text-xs text-muted-foreground font-mono">{commit.sha.substring(0, 7)}</p>
                                <p className="text-xs text-muted-foreground">{commit.author}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(commit.date).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No commits found</p>
                    <p className="text-sm mt-2">This repository is empty or has no commits yet.</p>
                    <p className="text-sm">Start translating sections to create commits!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Diff Viewer */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Diff Viewer</CardTitle>
                <CardDescription>
                  {baseCommit && headCommit
                    ? `Comparing ${baseCommit.substring(0, 7)} → ${headCommit.substring(0, 7)}`
                    : "Select two commits to view differences"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!baseCommit || !headCommit ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No Comparison Selected</p>
                    <p className="text-sm">Select base and head commits from the sidebar to view differences</p>
                  </div>
                ) : diffLoading ? (
                  <div className="text-center py-16">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Loading diff...</p>
                  </div>
                ) : parsedDiff && parsedDiff.length > 0 ? (
                  <div className="font-mono text-sm overflow-x-auto">
                    {parsedDiff.map((change, index) => (
                      <div
                        key={index}
                        className={`px-4 py-1 ${
                          change.type === "add"
                            ? "bg-green-50 text-green-900 border-l-4 border-green-500"
                            : change.type === "remove"
                            ? "bg-red-50 text-red-900 border-l-4 border-red-500"
                            : "bg-gray-50 text-gray-700"
                        }`}
                      >
                        <span className="select-none mr-2">
                          {change.type === "add" ? "+" : change.type === "remove" ? "-" : " "}
                        </span>
                        {change.content}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No Differences Found</p>
                    <p className="text-sm">The selected commits have identical content</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

