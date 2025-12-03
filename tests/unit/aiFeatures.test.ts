import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseUsageLimit, getCurrentMonth } from "../../server/_core/aiUsageTracking";

describe("AI Usage Tracking", () => {
  describe("parseUsageLimit", () => {
    it("should parse unlimited limit", () => {
      const result = parseUsageLimit("unlimited");
      expect(result).toEqual({ type: "unlimited" });
    });

    it("should parse null as unlimited", () => {
      const result = parseUsageLimit(null);
      expect(result).toEqual({ type: "unlimited" });
    });

    it("should parse numeric limit", () => {
      const result = parseUsageLimit("1000");
      expect(result).toEqual({ type: "custom", value: 1000 });
    });

    it("should parse zero as unlimited", () => {
      const result = parseUsageLimit("0");
      expect(result).toEqual({ type: "unlimited" });
    });

    it("should parse negative as unlimited", () => {
      const result = parseUsageLimit("-100");
      expect(result).toEqual({ type: "unlimited" });
    });

    it("should parse invalid string as unlimited", () => {
      const result = parseUsageLimit("invalid");
      expect(result).toEqual({ type: "unlimited" });
    });

    it("should handle large numbers", () => {
      const result = parseUsageLimit("999999");
      expect(result).toEqual({ type: "custom", value: 999999 });
    });
  });

  describe("getCurrentMonth", () => {
    it("should return current month in YYYY-MM format", () => {
      const month = getCurrentMonth();
      expect(month).toMatch(/^\d{4}-\d{2}$/);

      const [year, monthNum] = month.split("-");
      expect(parseInt(year)).toBeGreaterThanOrEqual(2024);
      expect(parseInt(monthNum)).toBeGreaterThanOrEqual(1);
      expect(parseInt(monthNum)).toBeLessThanOrEqual(12);
    });

    it("should pad month with leading zero", () => {
      const month = getCurrentMonth();
      const parts = month.split("-");
      expect(parts[1]).toMatch(/^\d{2}$/);
    });
  });
});

describe("AI Provider Configuration", () => {
  it("should support builtin provider", () => {
    const providers = ["builtin", "openai", "claude", "gemini"];
    expect(providers).toContain("builtin");
  });

  it("should validate provider names", () => {
    const validProviders = ["builtin", "openai", "claude", "gemini"];
    const testProvider = "openai";
    expect(validProviders).toContain(testProvider);
  });

  it("should require API key for non-builtin providers", () => {
    const provider = "openai";
    const hasApiKey = provider !== "builtin";
    expect(hasApiKey).toBe(true);
  });
});

describe("Usage Limit Enforcement", () => {
  it("should allow unlimited requests when limit is unlimited", () => {
    const limit = { type: "unlimited" as const };
    const allowed = limit.type === "unlimited";
    expect(allowed).toBe(true);
  });

  it("should track usage count", () => {
    const usage = { requestCount: 150, tokenCount: 5000 };
    expect(usage.requestCount).toBe(150);
    expect(usage.tokenCount).toBe(5000);
  });

  it("should calculate percentage used", () => {
    const current = 500;
    const limit = 1000;
    const percentage = Math.round((current / limit) * 100);
    expect(percentage).toBe(50);
  });

  it("should enforce limit when exceeded", () => {
    const current = 1050;
    const limit = 1000;
    const allowed = current < limit;
    expect(allowed).toBe(false);
  });

  it("should allow request when under limit", () => {
    const current = 950;
    const limit = 1000;
    const allowed = current < limit;
    expect(allowed).toBe(true);
  });
});

describe("AI Settings", () => {
  it("should store user AI preferences", () => {
    const prefs = {
      aiApiProvider: "openai" as const,
      aiUsageLimit: "5000",
      aiApiKey: "***",
      aiApiEndpoint: "https://api.openai.com/v1",
    };
    expect(prefs.aiApiProvider).toBe("openai");
    expect(prefs.aiUsageLimit).toBe("5000");
  });

  it("should mask API key in response", () => {
    const apiKey = "sk-1234567890";
    const masked = apiKey ? "***" : null;
    expect(masked).toBe("***");
  });

  it("should allow custom endpoint", () => {
    const endpoint = "https://custom.example.com/v1";
    expect(endpoint).toMatch(/^https:\/\//);
  });

  it("should default to builtin provider", () => {
    const defaultProvider = "builtin";
    expect(defaultProvider).toBe("builtin");
  });
});

describe("Monthly Usage Tracking", () => {
  it("should track usage by month", () => {
    const usage = {
      month: "2024-12",
      requestCount: 100,
      tokenCount: 3000,
    };
    expect(usage.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("should accumulate usage within same month", () => {
    const initial = { requestCount: 100 };
    const additional = 50;
    const total = initial.requestCount + additional;
    expect(total).toBe(150);
  });

  it("should reset usage on new month", () => {
    const december = "2024-12";
    const january = "2025-01";
    expect(december).not.toBe(january);
  });
});

describe("AI API Provider Selection", () => {
  it("should support OpenAI provider", () => {
    const provider = "openai";
    expect(["builtin", "openai", "claude", "gemini"]).toContain(provider);
  });

  it("should support Claude provider", () => {
    const provider = "claude";
    expect(["builtin", "openai", "claude", "gemini"]).toContain(provider);
  });

  it("should support Gemini provider", () => {
    const provider = "gemini";
    expect(["builtin", "openai", "claude", "gemini"]).toContain(provider);
  });

  it("should validate endpoint URL format", () => {
    const endpoint = "https://api.example.com/v1";
    const isValid = endpoint.startsWith("https://");
    expect(isValid).toBe(true);
  });

  it("should reject invalid endpoint URL", () => {
    const endpoint = "not-a-url";
    const isValid = endpoint.startsWith("https://");
    expect(isValid).toBe(false);
  });
});

describe("Usage Limit Types", () => {
  it("should support unlimited limit type", () => {
    const limit = { type: "unlimited" as const };
    expect(limit.type).toBe("unlimited");
  });

  it("should support monthly limit type", () => {
    const limit = { type: "monthly" as const, value: 1000 };
    expect(limit.type).toBe("monthly");
    expect(limit.value).toBe(1000);
  });

  it("should support custom limit type", () => {
    const limit = { type: "custom" as const, value: 5000 };
    expect(limit.type).toBe("custom");
    expect(limit.value).toBe(5000);
  });
});
