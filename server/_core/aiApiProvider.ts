import { invokeLLM } from "./llm";
import { checkUsageLimit } from "./aiUsageTracking";

type AiProvider = "builtin" | "openai" | "claude" | "gemini";

interface AiProviderConfig {
  provider: AiProvider;
  apiKey?: string;
  endpoint?: string;
}

/**
 * Abstraction layer for different AI API providers
 * Handles provider-specific configuration and API calls
 */
export class AiApiProvider {
  private config: AiProviderConfig;
  private userId: string;

  constructor(userId: string, config: AiProviderConfig) {
    this.userId = userId;
    this.config = config;
  }

  /**
   * Check if user is allowed to make AI requests based on usage limits
   */
  async checkUsageAllowed(): Promise<boolean> {
    const usage = await checkUsageLimit(this.userId);
    return usage.allowed;
  }

  /**
   * Get usage information for the current user
   */
  async getUsageInfo() {
    return checkUsageLimit(this.userId);
  }

  /**
   * Translate text using the configured AI provider
   */
  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    // Check usage limits
    const allowed = await this.checkUsageAllowed();
    if (!allowed) {
      throw new Error("AI usage limit exceeded for this month");
    }

    // Route to appropriate provider
    switch (this.config.provider) {
      case "builtin":
        return this.translateWithBuiltin(text, sourceLanguage, targetLanguage);
      case "openai":
        return this.translateWithOpenAi(text, sourceLanguage, targetLanguage);
      case "claude":
        return this.translateWithClaude(text, sourceLanguage, targetLanguage);
      case "gemini":
        return this.translateWithGemini(text, sourceLanguage, targetLanguage);
      default:
        throw new Error(`Unsupported AI provider: ${this.config.provider}`);
    }
  }

  /**
   * Translate using platform's built-in AI API
   */
  private async translateWithBuiltin(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Return only the translated text without any explanations.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    const translatedText = typeof content === "string" ? content : "";
    return translatedText.trim();
  }

  /**
   * Translate using OpenAI API
   */
  private async translateWithOpenAi(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const endpoint = this.config.endpoint || "https://api.openai.com/v1";

    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Return only the translated text without any explanations.`,
            },
            {
              role: "user",
              content: text,
            },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
      throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Translate using Claude API
   */
  private async translateWithClaude(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error("Claude API key not configured");
    }

    const endpoint = this.config.endpoint || "https://api.anthropic.com/v1";

    try {
      const response = await fetch(`${endpoint}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Return only the translated text without any explanations.\n\n${text}`,
            },
          ],
          system: `You are a professional translator.`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.content[0]?.text?.trim() || "";
    } catch (error) {
      throw new Error(`Claude translation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Translate using Google Gemini API
   */
  private async translateWithGemini(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const endpoint =
      this.config.endpoint ||
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Return only the translated text without any explanations.\n\n${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.candidates[0]?.content?.parts[0]?.text?.trim() || "";
    } catch (error) {
      throw new Error(`Gemini translation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Factory function to create AI provider instance
 */
export async function createAiProvider(
  userId: string,
  userConfig?: {
    provider?: AiProvider;
    apiKey?: string;
    endpoint?: string;
  }
): Promise<AiApiProvider> {
  const config: AiProviderConfig = {
    provider: userConfig?.provider || "builtin",
    apiKey: userConfig?.apiKey,
    endpoint: userConfig?.endpoint,
  };

  return new AiApiProvider(userId, config);
}
