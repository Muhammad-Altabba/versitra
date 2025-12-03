import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AdminUserManagement() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [newLimit, setNewLimit] = useState<string>("unlimited");
  const [customLimit, setCustomLimit] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch all users
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();

  // Fetch user AI usage
  const { data: userUsage } = trpc.admin.getUserAiUsage.useQuery(
    { userId: selectedUserId },
    { enabled: !!selectedUserId }
  );

  // Update user AI limit mutation
  const updateLimitMutation = trpc.admin.updateUserAiLimit.useMutation();

  const handleUpdateLimit = async () => {
    if (!selectedUserId) {
      setMessage({ type: "error", text: "Please select a user" });
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const finalLimit = newLimit === "custom" ? customLimit : newLimit;

      await updateLimitMutation.mutateAsync({
        userId: selectedUserId,
        aiUsageLimit: finalLimit,
      });

      setMessage({ type: "success", text: "User AI limit updated successfully" });
      setNewLimit("unlimited");
      setCustomLimit("");
      
      // Refetch user data
      await refetchUsers();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update limit",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage AI usage limits for all users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Selection */}
          <div className="space-y-3">
            <Label htmlFor="user-select">Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select">
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {usersLoading ? (
                  <div className="p-2 text-sm text-muted-foreground">Loading users...</div>
                ) : users && users.length > 0 ? (
                  users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email || user.id}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">No users found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* User Details */}
          {selectedUserId && userUsage && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div>
                    <strong>Current Usage:</strong> {userUsage.current} requests this month
                  </div>
                  {userUsage.limit && (
                    <div>
                      <strong>Limit:</strong> {userUsage.limit} requests/month ({userUsage.percentageUsed}%)
                    </div>
                  )}
                  {!userUsage.limit && (
                    <div>
                      <strong>Limit:</strong> Unlimited
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Update Limit */}
          {selectedUserId && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Update AI Usage Limit</h3>

              <div className="space-y-3">
                <Label htmlFor="limit-select">New Monthly Limit</Label>
                <Select value={newLimit} onValueChange={setNewLimit}>
                  <SelectTrigger id="limit-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                    <SelectItem value="1000">1,000 requests/month</SelectItem>
                    <SelectItem value="5000">5,000 requests/month</SelectItem>
                    <SelectItem value="10000">10,000 requests/month</SelectItem>
                    <SelectItem value="50000">50,000 requests/month</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newLimit === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="custom-limit">Custom Limit (requests/month)</Label>
                  <Input
                    id="custom-limit"
                    type="number"
                    min="1"
                    placeholder="Enter custom limit"
                    value={customLimit}
                    onChange={(e) => setCustomLimit(e.target.value)}
                  />
                </div>
              )}

              <Button
                onClick={handleUpdateLimit}
                disabled={isUpdating}
                className="w-full"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Limit"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View all users and their AI usage</CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users && users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Signed In</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <TableCell className="font-medium">{user.name || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {user.lastSignedIn
                          ? new Date(user.lastSignedIn).toLocaleDateString()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          )}
        </CardContent>
      </Card>

      {/* Messages */}
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
