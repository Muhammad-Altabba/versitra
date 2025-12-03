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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

type AiProvider = "builtin" | "openai" | "claude" | "gemini";

interface AiSettingsPanelProps {
  isAdmin?: boolean;
  onSave?: () => void;
}

export default function AiSettingsPanel({ onSave, isAdmin = false }: AiSettingsPanelProps) {
  const [provider, setProvider] = useState<AiProvider>("builtin");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [usageLimit, setUsageLimit] = useState("unlimited");
  const [customLimit, setCustomLimit] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updatePreferencesMutation = trpc.user.updateAiPreferences.useMutation();
  const getUsageQuery = trpc.user.getAiUsage.useQuery();

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const finalLimit = usageLimit === "custom" ? customLimit : usageLimit;

      await updatePreferencesMutation.mutateAsync({
        aiApiProvider: provider,
        aiApiKey: provider !== "builtin" ? apiKey : undefined,
        aiApiEndpoint: provider !== "builtin" ? endpoint : undefined,
        aiUsageLimit: finalLimit,
      });

      setMessage({ type: "success", text: "AI settings saved successfully" });
      onSave?.();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckUsage = () => {
    getUsageQuery.refetch();
  };

  const getProviderDescription = (p: AiProvider) => {
    const descriptions: Record<AiProvider, string> = {
      builtin: "Use the platform's built-in AI API (included)",
      openai: "Use your own OpenAI API key (GPT-4, GPT-3.5)",
      claude: "Use your own Anthropic Claude API key",
      gemini: "Use your own Google Gemini API key",
    };
    return descriptions[p];
  };

  return (
    <div className="space-y-6">
      {/* AI Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>AI API Provider</CardTitle>
          <CardDescription>Choose which AI service to use for translations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="builtin">Platform Built-in</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="claude">Anthropic Claude</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{getProviderDescription(provider)}</p>
          </div>

          {provider !== "builtin" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your API key is encrypted and stored securely
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endpoint">API Endpoint (Optional)</Label>
                <Input
                  id="endpoint"
                  placeholder="https://api.example.com/v1"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use the default endpoint
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Limits - Admin Only */}
      {isAdmin && (
      <Card>
        <CardHeader>
          <CardTitle>Usage Limits</CardTitle>
          <CardDescription>Set monthly limits for AI API usage (Admin only)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="limit">Monthly Limit</Label>
            <Select value={usageLimit} onValueChange={setUsageLimit}>
              <SelectTrigger id="limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlimited">Unlimited</SelectItem>
                <SelectItem value="1000">1,000 requests/month</SelectItem>
                <SelectItem value="5000">5,000 requests/month</SelectItem>
                <SelectItem value="10000">10,000 requests/month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {usageLimit === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customLimit">Custom Limit (requests/month)</Label>
              <Input
                id="customLimit"
                type="number"
                min="1"
                placeholder="Enter custom limit"
                value={customLimit}
                onChange={(e) => setCustomLimit(e.target.value)}
              />
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleCheckUsage}
            disabled={getUsageQuery.isLoading}
          >
            {getUsageQuery.isLoading ? "Checking..." : "Check Current Usage"}
          </Button>

          {getUsageQuery.data && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Current month: {getUsageQuery.data.current} requests
                {getUsageQuery.data.limit && (
                  <> / {getUsageQuery.data.limit} limit ({getUsageQuery.data.percentageUsed}%)</>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      )}

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

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? "Saving..." : "Save AI Settings"}
      </Button>
    </div>
  );
}
