import { Bot, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { askSalesAssistant } from "@/services/geminiAssistant";
import type { MenuFixture, Order } from "@/types/order";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  toolsCalled?: string[];
}

interface SalesAssistantPanelProps {
  orders: Order[];
  menu: MenuFixture;
  askFn?: typeof askSalesAssistant;
}

const SAMPLE_QUESTIONS = [
  "How many orders?",
  "What is our total revenue?",
  "What is the best-selling option?",
  "Revenue by payment method?",
  "How many orders got MORNING15?",
  "Who is our best customer?",
];

export function SalesAssistantPanel({
  orders,
  menu,
  askFn = askSalesAssistant,
}: SalesAssistantPanelProps) {
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const submitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await askFn({
        question: trimmed,
        orders,
        menu,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}-${Math.random()}`,
          role: "assistant",
          text: result.reply,
          toolsCalled: result.toolsCalled,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}-${Math.random()}`,
          role: "error",
          text:
            err instanceof Error
              ? err.message
              : "Failed to get response from assistant.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-200/90 shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Bot className="h-4 w-4 text-amber-600" />
            Staff Sales Assistant
          </CardTitle>
          <Badge variant="secondary" className="text-[11px]">
            <Sparkles className="mr-1 h-3 w-3 text-amber-600" />
            Gemini Flash · {orders.length} live orders
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => void submitQuestion(q)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <div
          className="max-h-72 space-y-2.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3"
          data-testid="assistant-messages"
        >
          {messages.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              Ask about order count, revenue, best-selling option, payment
              breakdown, coupon usage, or a specific date (YYYY-MM-DD).
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg p-2.5 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "ml-8 bg-slate-900 text-white"
                    : msg.role === "error"
                      ? "mr-8 border border-rose-200 bg-rose-50 text-rose-800"
                      : "mr-8 border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Tools used: {msg.toolsCalled.join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submitQuestion(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a sales question (English or Bangla)..."
            aria-label="Ask sales assistant"
            disabled={loading}
            className="text-sm"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
