"use client";

import React, { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { getAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizontal, Wand2 } from "@/lib/icons";
import { cn } from "@/lib/utils";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolEvent = {
  name: string;
  label: string;
  result?: Record<string, unknown>;
  done: boolean;
};

type UserMessage = { id: string; role: "user"; content: string };
type AssistantMessage = {
  id: string;
  role: "assistant";
  content: string;
  tools: ToolEvent[];
  streaming: boolean;
};
type Message = UserMessage | AssistantMessage;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2);
}

function toConversationMessages(messages: Message[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

// ─── Tool indicator ──────────────────────────────────────────────────────────

function ToolIndicator({ tool }: { tool: ToolEvent }) {
  const isScenario = tool.name === "create_scenario" && tool.result?.id;
  const isSuite = tool.name === "create_suite" && tool.result?.id;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs w-fit",
        tool.done
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-primary/20 bg-primary/5 text-primary",
      )}
    >
      {!tool.done && <Loader2 className="h-3 w-3 animate-spin" />}
      <span>{tool.done ? tool.label.replace("…", " ✓") : tool.label}</span>
      {isScenario && (
        <Link
          href={`/scenarios/${tool.result!.id}`}
          className="ml-1 underline text-primary hover:opacity-80"
        >
          View
        </Link>
      )}
      {isSuite && (
        <Link
          href={`/suites/${tool.result!.id}`}
          className="ml-1 underline text-primary hover:opacity-80"
        >
          View
        </Link>
      )}
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={i} className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.8em]">{part.slice(1, -1)}</code>;
    return part;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={`code-${i}`} className="my-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      i++;
      continue;
    }

    const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = ["mt-2 text-sm font-bold", "mt-1.5 text-sm font-semibold", "mt-1 text-sm font-medium"][level - 1];
      nodes.push(<p key={`h-${i}`} className={cls}>{renderInline(hMatch[2])}</p>);
      i++;
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5 pl-4">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      const firstMatch = line.match(/^(\d+)\./);
      const start = firstMatch ? parseInt(firstMatch[1]) : 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-1 list-decimal space-y-0.5 pl-5" start={start}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (!line.trim()) {
      nodes.push(<div key={`br-${i}`} className="h-1" />);
      i++;
      continue;
    }

    nodes.push(<p key={`p-${i}`}>{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-0.5 text-sm leading-relaxed">{nodes}</div>;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {message.role === "assistant" && message.tools.length > 0 && (
          <div className="mb-2 flex flex-col gap-1.5">
            {message.tools.map((t, i) => (
              <ToolIndicator key={i} tool={t} />
            ))}
          </div>
        )}
        {message.content ? (
          isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )
        ) : message.role === "assistant" && message.streaming ? (
          <span className="inline-block h-4 w-1 animate-pulse bg-current rounded-full" />
        ) : null}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BenchAgentPage() {
  const { activeWorkspaceId } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: UserMessage = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    const assistantMsg: AssistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      tools: [],
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    // Resize textarea back to single line
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const token = getAuthToken();
    const conversationSoFar = toConversationMessages([...messages, userMsg]);

    try {
      const response = await fetch(`${API_URL}/api/bench-agent/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: conversationSoFar,
          workspace_id: activeWorkspaceId ?? null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              name?: string;
              label?: string;
              result?: Record<string, unknown>;
              message?: string;
            };

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId || m.role !== "assistant") return m;

                if (data.type === "delta" && data.text) {
                  return { ...m, content: m.content + data.text };
                }
                if (data.type === "tool_start") {
                  return {
                    ...m,
                    tools: [
                      ...m.tools,
                      { name: data.name ?? "", label: data.label ?? data.name ?? "", done: false },
                    ],
                  };
                }
                if (data.type === "tool_done") {
                  const tools = [...m.tools];
                  const lastPending = [...tools].reverse().findIndex((t) => !t.done);
                  if (lastPending !== -1) {
                    const idx = tools.length - 1 - lastPending;
                    tools[idx] = { ...tools[idx], result: data.result, done: true };
                  }
                  return { ...m, tools };
                }
                if (data.type === "done") {
                  return { ...m, streaming: false };
                }
                if (data.type === "error") {
                  return { ...m, content: m.content || `Error: ${data.message}`, streaming: false };
                }
                return m;
              }),
            );
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.role === "assistant"
            ? { ...m, content: `Something went wrong. Please try again.`, streaming: false }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <Wand2 className="h-5 w-5 text-primary" />
        <h1 className="text-base font-semibold">Bench AI</h1>
        <span className="text-xs text-muted-foreground ml-1">— create scenarios and suites conversationally</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Wand2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">Meet Bench AI</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Describe your agent and I'll probe it, then write test scenarios and suites for you.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {[
                "What agents do I have?",
                "Create scenarios for my booking agent",
                "Show me my existing scenarios",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                  className="text-sm text-primary border border-primary/20 rounded-lg px-4 py-2 hover:bg-primary/5 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask Bench AI to create scenarios, probe agents, or build suites…"
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-0.5"
            style={{ minHeight: "24px", maxHeight: "160px" }}
            aria-label="Message input"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void send()}
            disabled={!input.trim() || loading}
            className="h-8 w-8 p-0 shrink-0"
            aria-label="Send message"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
