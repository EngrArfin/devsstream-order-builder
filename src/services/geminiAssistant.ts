
import {
  getAverageOrderValue,
  getBestSellingOption,
  getCouponUsageStats,
  getOrderCount,
  getOrdersByDate,
  getRevenueByPaymentMethod,
  getTotalRevenue,
} from "@/engine/stats";
import type { MenuFixture, Order } from "@/types/order";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export interface GeminiAssistantResult {
  reply: string;
  toolsCalled: string[];
}

export class AssistantError extends Error {
  code:
    | "MISSING_KEY"
    | "INVALID_KEY"
    | "QUOTA_EXCEEDED"
    | "MODEL_UNAVAILABLE"
    | "NETWORK_ERROR"
    | "API_ERROR";

  constructor(
    code: AssistantError["code"],
    message: string
  ) {
    super(message);
    this.name = "AssistantError";
    this.code = code;
  }
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

const FUNCTION_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: "getOrderCount",
    description: "Returns the total number of completed orders.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getTotalRevenue",
    description:
      "Returns the total revenue across all completed orders in poisha and BDT.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getBestSellingOption",
    description:
      "Returns the best-selling menu options counted by total units (line quantity * option quantity).",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "How many top options to return (defaults to 1).",
        },
      },
    },
  },
  {
    name: "getRevenueByPaymentMethod",
    description:
      "Returns order count and total revenue grouped by payment method (card, bkash, cash).",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getAverageOrderValue",
    description:
      "Returns the average order value across all orders in poisha and BDT.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getCouponUsageStats",
    description:
      "Returns how many orders actually received a coupon discount versus how many entered it and were rejected.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Coupon code to inspect, e.g. MORNING15.",
        },
      },
    },
  },
  {
    name: "getOrdersByDate",
    description:
      "Returns orders and revenue on a specific calendar date (YYYY-MM-DD) in Asia/Dhaka time.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Target date in YYYY-MM-DD format (Asia/Dhaka).",
        },
      },
      required: ["date"],
    },
  },
];

const SYSTEM_INSTRUCTION = `You are a concise, accurate sales assistant for a breakfast shop.
Rules:
1. You NEVER calculate numbers yourself. Always call the provided tool functions to read order metrics.
2. Only state numbers, option names, and facts returned by tool outputs.
3. Orders only store: id, createdAt, paymentMethod (card/bkash/cash), items, coupon status, and pricing in BDT/poisha. Orders do NOT store any customer name, phone, email, or customer ID.
4. If the user asks about customer identity (such as "Who is our best customer?") or anything unavailable in the order schema/tools, state clearly that customer data is not stored in the orders and do NOT invent any name or guess.
5. Reply in the user's language (plain English, or Bangla if asked in Bangla). Keep answers short and clear, using BDT for money amounts.`;

export function executeStatsTool(
  name: string,
  args: Record<string, unknown> | undefined,
  orders: Order[],
  menu: MenuFixture
): unknown {
  switch (name) {
    case "getOrderCount":
      return getOrderCount(orders);
    case "getTotalRevenue":
      return getTotalRevenue(orders);
    case "getBestSellingOption": {
      const rawLimit = args?.limit;
      const limit =
        typeof rawLimit === "number" && Number.isFinite(rawLimit)
          ? rawLimit
          : 1;
      return getBestSellingOption(orders, menu, limit);
    }
    case "getRevenueByPaymentMethod":
      return getRevenueByPaymentMethod(orders);
    case "getAverageOrderValue":
      return getAverageOrderValue(orders);
    case "getCouponUsageStats": {
      const code =
        typeof args?.code === "string" && args.code.trim()
          ? args.code
          : "MORNING15";
      return getCouponUsageStats(orders, code);
    }
    case "getOrdersByDate": {
      const date = typeof args?.date === "string" ? args.date : "";
      return getOrdersByDate(orders, date);
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: {
      result: unknown;
    };
  };
}

interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

async function callGeminiApi(
  apiKey: string,
  model: string,
  contents: GeminiContent[],
  fetchFn: typeof fetch
): Promise<GeminiApiResponse> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        tools: [
          {
            functionDeclarations: FUNCTION_DECLARATIONS,
          },
        ],
        contents,
      }),
    });
  } catch {
    throw new AssistantError(
      "NETWORK_ERROR",
      "Network error while contacting Gemini API. Please check your connection and try again."
    );
  }

  const data = (await response.json().catch(() => ({}))) as GeminiApiResponse;

  if (!response.ok) {
    const rawMsg = data.error?.message ?? "";
    const statusStr = data.error?.status ?? "";
    if (response.status === 429 || statusStr === "RESOURCE_EXHAUSTED") {
      throw new AssistantError(
        "QUOTA_EXCEEDED",
        "Gemini API quota limit reached (429). Please wait a moment and try again."
      );
    }
    if (
      response.status === 401 ||
      response.status === 403 ||
      /api key not valid/i.test(rawMsg) ||
      /api_key_invalid/i.test(rawMsg)
    ) {
      throw new AssistantError(
        "INVALID_KEY",
        "Invalid Gemini API key. Check VITE_GEMINI_API_KEY in .env.local."
      );
    }
    if (
      response.status === 503 ||
      response.status === 404 ||
      statusStr === "UNAVAILABLE" ||
      /high demand/i.test(rawMsg) ||
      /no longer available/i.test(rawMsg) ||
      /response modalities/i.test(rawMsg) ||
      /not supported by the model/i.test(rawMsg) ||
      /not found for api version/i.test(rawMsg)
    ) {
      throw new AssistantError(
        "MODEL_UNAVAILABLE",
        rawMsg || `Gemini model temporarily unavailable (${response.status}).`
      );
    }
    throw new AssistantError(
      "API_ERROR",
      rawMsg || `Gemini API request failed (${response.status}).`
    );
  }

  return data;
}

interface GeminiModelsListResponse {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
}

const EXCLUDED_FLASH_VARIANT_RE =
  /(tts|audio|image|live|robotics|computer-use|vision|embedding|aqa|omni)/i;

const PREFERRED_FLASH_RANK = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

function scoreFlashModel(name: string): number {
  const exactIdx = PREFERRED_FLASH_RANK.indexOf(name);
  if (exactIdx !== -1) {
    return exactIdx;
  }
  const hasPreview = /preview|exp/i.test(name);
  return PREFERRED_FLASH_RANK.length + (hasPreview ? 10 : 0);
}

async function discoverAlternativeFlashModels(
  apiKey: string,
  excludeModel: string,
  fetchFn: typeof fetch
): Promise<string[]> {
  try {
    const res = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) {
      return [];
    }
    const data = (await res.json().catch(() => ({}))) as GeminiModelsListResponse;
    const models = data.models ?? [];
    return models
      .filter(
        (m) =>
          typeof m.name === "string" &&
          /flash/i.test(m.name) &&
          !EXCLUDED_FLASH_VARIANT_RE.test(m.name) &&
          m.supportedGenerationMethods?.includes("generateContent")
      )
      .map((m) => m.name!.replace(/^models\//, ""))
      .filter((name) => name !== excludeModel)
      .sort((a, b) => scoreFlashModel(a) - scoreFlashModel(b));
  } catch {
    return [];
  }
}

function waitMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiWithFallback(
  apiKey: string,
  requestedModel: string,
  contents: GeminiContent[],
  fetchFn: typeof fetch,
  retryDelayMs = 600
): Promise<{ data: GeminiApiResponse; usedModel: string }> {
  let primaryError: AssistantError | null = null;

  // Attempt 1 & quick retry only on transient high-demand errors (503)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await callGeminiApi(apiKey, requestedModel, contents, fetchFn);
      return { data, usedModel: requestedModel };
    } catch (err) {
      if (!(err instanceof AssistantError) || err.code !== "MODEL_UNAVAILABLE") {
        throw err;
      }
      primaryError = err;
      const isNotFound = /not found|no longer available/i.test(err.message);
      if (isNotFound) {
        break;
      }
      if (attempt === 0) {
        await waitMs(retryDelayMs);
      }
    }
  }

  // If primary model is still unavailable, discover active text Flash models for this key
  if (requestedModel === DEFAULT_GEMINI_MODEL) {
    const alternatives = await discoverAlternativeFlashModels(
      apiKey,
      requestedModel,
      fetchFn
    );
    for (const altModel of alternatives) {
      try {
        const data = await callGeminiApi(apiKey, altModel, contents, fetchFn);
        return { data, usedModel: altModel };
      } catch (err) {
        if (
          err instanceof AssistantError &&
          err.code === "MODEL_UNAVAILABLE"
        ) {
          continue;
        }
        throw err;
      }
    }
  }

  throw (
    primaryError ??
    new AssistantError(
      "MODEL_UNAVAILABLE",
      "Gemini Flash is temporarily busy. Please try again in a few seconds."
    )
  );
}

export interface AskSalesAssistantParams {
  question: string;
  orders: Order[];
  menu: MenuFixture;
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
  retryDelayMs?: number;
}

export async function askSalesAssistant({
  question,
  orders,
  menu,
  apiKey = import.meta.env.VITE_GEMINI_API_KEY,
  model = DEFAULT_GEMINI_MODEL,
  fetchFn = fetch,
  retryDelayMs = 600,
}: AskSalesAssistantParams): Promise<GeminiAssistantResult> {
  const trimmedKey = apiKey?.trim();
  if (!trimmedKey) {
    throw new AssistantError(
      "MISSING_KEY",
      "Missing VITE_GEMINI_API_KEY. Add your Google AI Studio key to .env.local and restart the dev server."
    );
  }

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new AssistantError("API_ERROR", "Please enter a question.");
  }

  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: [{ text: trimmedQuestion }],
    },
  ];
  const toolsCalled: string[] = [];
  let activeModel = model;

  for (let round = 0; round < 4; round += 1) {
    const { data: res, usedModel } = await callGeminiWithFallback(
      trimmedKey,
      activeModel,
      contents,
      fetchFn,
      retryDelayMs
    );
    activeModel = usedModel;
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter((p) => Boolean(p.functionCall));

    if (functionCalls.length === 0) {
      const textReply = parts
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      return {
        reply:
          textReply ||
          "I could not determine an answer from the available order metrics.",
        toolsCalled,
      };
    }

    contents.push({
      role: "model",
      parts,
    });

    const responseParts: GeminiPart[] = functionCalls.map((part) => {
      const call = part.functionCall!;
      toolsCalled.push(call.name);
      const toolOutput = executeStatsTool(call.name, call.args, orders, menu);
      return {
        functionResponse: {
          name: call.name,
          response: {
            result: toolOutput,
          },
        },
      };
    });

    contents.push({
      role: "function",
      parts: responseParts,
    });
  }

  return {
    reply: "Tool call limit reached before generating a final summary.",
    toolsCalled,
  };
}
