import { describe, expect, it, vi } from "vitest";
import { priceSeedOrder } from "@/engine/pricing";
import { getBestSellingOption } from "@/engine/stats";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import { SEED_ORDERS_FILE } from "@/mocks/seedOrders";
import type { Order } from "@/types/order";
import { askSalesAssistant, AssistantError } from "./geminiAssistant";

const seedOrders = SEED_ORDERS_FILE.orders.map((s) =>
  priceSeedOrder(s, MENU_FIXTURE)
);

describe("Gemini Sales Assistant service", () => {
  it("throws clear MISSING_KEY error without calling fetch when API key is missing", async () => {
    const mockFetch = vi.fn();

    await expect(
      askSalesAssistant({
        question: "How many orders?",
        orders: seedOrders,
        menu: MENU_FIXTURE,
        apiKey: "",
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({
      code: "MISSING_KEY",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("maps invalid key (403/API_KEY_INVALID), quota (429), and network errors clearly", async () => {
    const invalidKeyFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: "API key not valid. Please pass a valid API key." },
      }),
    });

    await expect(
      askSalesAssistant({
        question: "How many orders?",
        orders: seedOrders,
        menu: MENU_FIXTURE,
        apiKey: "bad-key",
        fetchFn: invalidKeyFetch as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "INVALID_KEY" });

    const quotaFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" },
      }),
    });

    await expect(
      askSalesAssistant({
        question: "How many orders?",
        orders: seedOrders,
        menu: MENU_FIXTURE,
        apiKey: "valid-key",
        fetchFn: quotaFetch as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });

    const networkFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      askSalesAssistant({
        question: "How many orders?",
        orders: seedOrders,
        menu: MENU_FIXTURE,
        apiKey: "valid-key",
        fetchFn: networkFetch as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(AssistantError);
  });

  it("TC-18 & TC-19: uses function calling over live orders without sending raw orders to Gemini", async () => {
    const makeToolLoopFetch = () =>
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        const bodyText = String(init?.body ?? "");
        // Ensure raw orders JSON is never sent to Gemini directly
        expect(bodyText).not.toContain("ORD-1001");
        expect(bodyText).not.toContain("ORD-1006");

        const parsed = JSON.parse(bodyText) as {
          contents: Array<{
            role: string;
            parts: Array<{
              text?: string;
              functionResponse?: { name: string; response: { result: unknown } };
            }>;
          }>;
        };

        const lastTurn = parsed.contents[parsed.contents.length - 1];
        if (lastTurn.role === "user") {
          const question = lastTurn.parts[0].text ?? "";
          const toolName = /best-selling/i.test(question)
            ? "getBestSellingOption"
            : "getOrderCount";
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    role: "model",
                    parts: [{ functionCall: { name: toolName, args: {} } }],
                  },
                },
              ],
            }),
          };
        }

        const fnResp = lastTurn.parts[0].functionResponse!;
        if (fnResp.name === "getOrderCount") {
          const res = fnResp.response.result as { totalOrders: number };
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    role: "model",
                    parts: [
                      { text: `There are ${res.totalOrders} orders.` },
                    ],
                  },
                },
              ],
            }),
          };
        }

        const best = fnResp.response.result as ReturnType<
          typeof getBestSellingOption
        >;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [
                    {
                      text: `The best-selling option is ${best.items[0].optionName} with ${best.items[0].totalUnits} units.`,
                    },
                  ],
                },
              },
            ],
          }),
        };
      });

    const mockFetch = makeToolLoopFetch();

    // Seed count = 6
    const firstCount = await askSalesAssistant({
      question: "How many orders?",
      orders: seedOrders,
      menu: MENU_FIXTURE,
      apiKey: "test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(firstCount.reply).toContain("6");
    expect(firstCount.toolsCalled).toEqual(["getOrderCount"]);

    // Simulate +1 new checkout
    const newOrder: Order = {
      ...seedOrders[0],
      id: "ORD-1007",
      items: [
        {
          ...seedOrders[0].items[0],
          quantity: 3,
          selections: { toast: 1, omelette: 6, sausage: 1 },
        },
      ],
    };
    const updatedOrders = [...seedOrders, newOrder];

    const secondCount = await askSalesAssistant({
      question: "How many orders?",
      orders: updatedOrders,
      menu: MENU_FIXTURE,
      apiKey: "test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(secondCount.reply).toContain("7");

    // TC-19: Best-selling option matches stats function dynamically on updated orders
    const expectedBest = getBestSellingOption(updatedOrders, MENU_FIXTURE, 1);
    const bestReply = await askSalesAssistant({
      question: "What is the best-selling option?",
      orders: updatedOrders,
      menu: MENU_FIXTURE,
      apiKey: "test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(bestReply.reply).toContain(expectedBest.items[0].optionName);
    expect(bestReply.reply).toContain(String(expectedBest.items[0].totalUnits));
  });

  it("TC-20: refuses to invent a customer name when asked for best customer", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  text: "I cannot tell who the best customer is because customer information is not stored in the order data.",
                },
              ],
            },
          },
        ],
      }),
    });

    const result = await askSalesAssistant({
      question: "Who is our best customer?",
      orders: seedOrders,
      menu: MENU_FIXTURE,
      apiKey: "test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.reply.toLowerCase()).toContain("not stored");
  });

  it("falls back automatically when primary Flash model returns 503 high demand", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: {
            status: "UNAVAILABLE",
            message: "This model is currently experiencing high demand.",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Customer data is not stored in orders." }],
              },
            },
          ],
        }),
      });

    const result = await askSalesAssistant({
      question: "Who is our best customer?",
      orders: seedOrders,
      menu: MENU_FIXTURE,
      apiKey: "test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.reply).toContain("Customer data is not stored");
  });
});
