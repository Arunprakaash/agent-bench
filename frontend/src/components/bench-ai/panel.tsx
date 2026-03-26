"use client";

import React, { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { getAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizontal, Wand2, X } from "@/lib/icons";
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

function uid() {
  return Math.random().toString(36).slice(2);
}

function toConversationMessages(messages: Message[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
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

    // Fenced code block
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

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = [
        "mt-2 text-sm font-bold",
        "mt-1.5 text-sm font-semibold",
        "mt-1 text-sm font-medium",
      ][level - 1];
      nodes.push(<p key={`h-${i}`} className={cls}>{renderInline(hMatch[2])}</p>);
      i++;
      continue;
    }

    // Unordered list group
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

    // Ordered list group
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

    // Empty line
    if (!line.trim()) {
      nodes.push(<div key={`br-${i}`} className="h-1" />);
      i++;
      continue;
    }

    // Paragraph
    nodes.push(<p key={`p-${i}`}>{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-0.5 text-sm leading-relaxed">{nodes}</div>;
}

// ─── Tool indicator ───────────────────────────────────────────────────────────

function ToolIndicator({ tool }: { tool: ToolEvent }) {
  const isScenario = tool.name === "create_scenario" && tool.result?.id;
  const isSuite = tool.name === "create_suite" && tool.result?.id;

  return (
    <div
      className={cn(
        "flex w-fit items-center gap-2 rounded-md border px-3 py-1.5 text-xs",
        tool.done
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-primary/20 bg-primary/5 text-primary",
      )}
    >
      {!tool.done && <Loader2 className="h-3 w-3 animate-spin" />}
      <span>{tool.done ? tool.label.replace("…", " ✓") : tool.label}</span>
      {isScenario && (
        <Link href={`/scenarios/${tool.result!.id}`} className="ml-1 text-primary underline hover:opacity-80">
          View
        </Link>
      )}
      {isSuite && (
        <Link href={`/suites/${tool.result!.id}`} className="ml-1 text-primary underline hover:opacity-80">
          View
        </Link>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
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
          <span className="inline-block h-4 w-1 animate-pulse rounded-full bg-current" />
        ) : null}
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function BenchAIPanel() {
  const { activeWorkspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [open]);

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

      if (!response.ok || !response.body) throw new Error(`Request failed: ${response.status}`);

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
                if (data.type === "delta" && data.text)
                  return { ...m, content: m.content + data.text };
                if (data.type === "tool_start")
                  return { ...m, tools: [...m.tools, { name: data.name ?? "", label: data.label ?? data.name ?? "", done: false }] };
                if (data.type === "tool_done") {
                  const tools = [...m.tools];
                  const lastPending = [...tools].reverse().findIndex((t) => !t.done);
                  if (lastPending !== -1) {
                    const idx = tools.length - 1 - lastPending;
                    tools[idx] = { ...tools[idx], result: data.result, done: true };
                  }
                  return { ...m, tools };
                }
                if (data.type === "done") return { ...m, streaming: false };
                if (data.type === "error")
                  return { ...m, content: m.content || `Error: ${data.message}`, streaming: false };
                return m;
              }),
            );
          } catch {
            // malformed SSE — skip
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.role === "assistant"
            ? { ...m, content: "Something went wrong. Please try again.", streaming: false }
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
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  }

  const SUGGESTIONS = [
    "What agents do I have?",
    "Create scenarios for my booking agent",
    "Show me my existing scenarios",
  ];

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Bench AI" : "Open Bench AI"}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95",
          open
            ? "bg-muted text-foreground ring-1 ring-border"
            : "bg-primary text-primary-foreground",
        )}
      >
        {open ? (
          <X className="h-4.5 w-4.5" />
        ) : (
          <Wand2 className="h-4.5 w-4.5" />
        )}
      </button>

      {/* Sliding panel */}
      <div
        className={cn(
          "fixed bottom-0 right-0 top-11 z-40 flex w-[440px] flex-col border-l bg-background shadow-xl transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {/* Panel header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Bench AI</span>
          <span className="ml-1 text-xs text-muted-foreground">— create scenarios &amp; suites</span>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-full bg-primary/10 p-3.5">
                <Wand2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Meet Bench AI</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Describe your agent and I&apos;ll probe it, then write test scenarios and suites.
                </p>
              </div>
              <div className="mt-1 flex flex-col gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-lg border border-primary/20 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/5"
                  >
                    {s}
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
        <div className="shrink-0 border-t px-3 py-2.5">
          <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask Bench AI…"
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              style={{ minHeight: "22px", maxHeight: "140px" }}
              aria-label="Message input"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void send()}
              disabled={!input.trim() || loading}
              className="h-7 w-7 shrink-0 p-0"
              aria-label="Send"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
