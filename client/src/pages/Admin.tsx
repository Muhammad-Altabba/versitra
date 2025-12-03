import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE } from "@/const";
import { Database, ExternalLink, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AdminUserManagement from "@/components/AdminUserManagement";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  // Check if user is admin
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need admin privileges to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
          </div>
          <div className="text-sm text-gray-600">
            Logged in as: <span className="font-semibold">{user?.name}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* User Management Section */}
        <div className="mb-8">
          <AdminUserManagement />
        </div>

        {/* Admin Tools Section */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Database Explorer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Explorer
              </CardTitle>
              <CardDescription>
                Browse and manage database tables using Drizzle Studio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Drizzle Studio provides a visual interface to explore all database tables, view records, and execute queries.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  To access the database explorer:
                </p>
                <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                  <li>Open a terminal in the project directory</li>
                  <li>Run: <code className="bg-gray-100 px-2 py-1 rounded">pnpm db:studio</code></li>
                  <li>Open <code className="bg-gray-100 px-2 py-1 rounded">http://localhost:4983</code> in your browser</li>
                </ol>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  <strong>Note:</strong> Drizzle Studio runs as a separate process. Make sure to stop it when done to free up the port.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                Platform statistics and health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-500">Application</div>
                  <div className="text-lg font-semibold">{APP_TITLE}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Environment</div>
                  <div className="text-lg font-semibold">
                    {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Database</div>
                  <div className="text-lg font-semibold">MySQL (TiDB)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common administrative tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setLocation('/')}
              >
                <Database className="mr-2 h-4 w-4" />
                View All Projects
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

