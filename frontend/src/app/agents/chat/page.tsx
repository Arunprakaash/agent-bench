"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type Agent, type AgentListItem, type ChatMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeft, ChevronLeft, SendHorizontal, Wand2, Wrench, X } from "@/lib/icons";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

export default function AgentChatBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </div>
      }
    >
      <AgentChatBuilderInner />
    </Suspense>
  );
}

function AgentChatBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentIdFromUrl = searchParams.get("agentId") ?? "";
  const snapshotKeyFromUrl = searchParams.get("snapshotKey") ?? "";
  const snapshotRunIdFromUrl = searchParams.get("snapshotRunId") ?? "";
  const skipAgentAutofillRef = useRef(false);

  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agentIdFromUrl);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const [agentModule, setAgentModule] = useState("test_agents.interview_agent");
  const [agentClass, setAgentClass] = useState("TestableInterviewAgent");
  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [agentArgs, setAgentArgs] = useState<Record<string, unknown>>(
    {
      candidate_name: "Alice",
      interview_prompt:
        "## Questions\n1. Tell me about yourself\n2. What is your experience with Python?",
    },
  );

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [toolEventBatches, setToolEventBatches] = useState<Array<Array<Record<string, unknown>>>>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [sourceRunId, setSourceRunId] = useState<string | null>(null);

  useEffect(() => {
    api.agents
      .list()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    if (!selectedAgentId) {
      setSelectedAgent(null);
      return;
    }
    api.agents
      .get(selectedAgentId)
      .then((a) => {
        setSelectedAgent(a);
        if (!skipAgentAutofillRef.current) {
          setAgentModule(a.module);
          setAgentClass(a.agent_class);
          setLlmModel(a.default_llm_model);
          setAgentArgs(a.default_agent_args ? { ...a.default_agent_args } : {});
          setHistory([]);
          setToolEventBatches([]);
        } else {
          skipAgentAutofillRef.current = false;
        }
      })
      .catch(() => setSelectedAgent(null));
  }, [selectedAgentId]);

  useEffect(() => {
    if (snapshotRunIdFromUrl) setSourceRunId(snapshotRunIdFromUrl);
  }, [snapshotRunIdFromUrl]);

  useEffect(() => {
    if (!snapshotKeyFromUrl) return;
    let parsed: Record<string, unknown> | null = null;
    try {
      const raw = window.sessionStorage.getItem(snapshotKeyFromUrl);
      if (!raw) {
        setSnapshotNotice("Snapshot not found in this browser session.");
        return;
      }
      parsed = JSON.parse(raw) as Record<string, unknown>;
      window.sessionStorage.removeItem(snapshotKeyFromUrl);
    } catch {
      setSnapshotNotice("Could not load execution snapshot.");
      return;
    }
    if (!parsed) return;

    const agentId = typeof parsed.agent_id === "string" ? parsed.agent_id : null;
    const agentModuleFromSnapshot =
      typeof parsed.agent_module === "string"
        ? parsed.agent_module
        : typeof parsed.module === "string"
          ? parsed.module
          : null;
    const agentClassFromSnapshot =
      typeof parsed.agent_class === "string"
        ? parsed.agent_class
        : typeof parsed.class_name === "string"
          ? parsed.class_name
          : null;
    const llmModelFromSnapshot =
      typeof parsed.llm_model === "string"
        ? parsed.llm_model
        : typeof parsed.model === "string"
          ? parsed.model
          : null;
    const agentArgsFromSnapshot =
      parsed.agent_args && typeof parsed.agent_args === "object"
        ? (parsed.agent_args as Record<string, unknown>)
        : null;
    const chatHistoryFromSnapshot =
      Array.isArray(parsed.chat_history) || Array.isArray(parsed.history)
        ? (Array.isArray(parsed.chat_history) ? parsed.chat_history : parsed.history)
        : null;

    if (agentId) {
      skipAgentAutofillRef.current = true;
      setSelectedAgentId(agentId);
    }
    if (agentModuleFromSnapshot) setAgentModule(agentModuleFromSnapshot);
    if (agentClassFromSnapshot) setAgentClass(agentClassFromSnapshot);
    if (llmModelFromSnapshot) setLlmModel(llmModelFromSnapshot);
    if (agentArgsFromSnapshot) setAgentArgs({ ...agentArgsFromSnapshot });
    if (chatHistoryFromSnapshot) {
      const normalized = chatHistoryFromSnapshot
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .map((m) => ({
          role:
            m.role === "assistant" || m.role === "system" || m.role === "user"
              ? (m.role as "assistant" | "system" | "user")
              : "user",
          content: typeof m.content === "string" ? m.content : "",
        }))
        .filter((m) => m.content.trim().length > 0);
      setHistory(normalized);
      setToolEventBatches([]);
    }

    setSnapshotNotice("Loaded execution snapshot into Chat Builder.");
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("snapshotKey");
    router.replace(`/agents/chat${sp.toString() ? `?${sp.toString()}` : ""}`);
  }, [router, searchParams, snapshotKeyFromUrl]);

  const turns = useMemo(() => {
    const t: Array<{ user_input: string }> = [];
    for (const msg of history) {
      if (msg.role === "user") t.push({ user_input: msg.content });
    }
    return t;
  }, [history]);

  const agentOptions = useMemo(() => {
    if (!selectedAgent) return agents;
    const exists = agents.some((a) => a.id === selectedAgent.id);
    if (exists) return agents;
    return [
      {
        id: selectedAgent.id,
        name: selectedAgent.name,
        description: selectedAgent.description,
        module: selectedAgent.module,
        agent_class: selectedAgent.agent_class,
        tags: selectedAgent.tags,
        updated_at: selectedAgent.updated_at,
      },
      ...agents,
    ];
  }, [agents, selectedAgent]);

  const selectedAgentLabel = useMemo(() => {
    if (!selectedAgentId) return "";
    if (selectedAgent?.id === selectedAgentId) return selectedAgent.name;
    const match = agentOptions.find((a) => a.id === selectedAgentId);
    return match?.name ?? "";
  }, [agentOptions, selectedAgent, selectedAgentId]);

  const send = async () => {
    const user_input = draft.trim();
    if (!user_input) return;

    setSending(true);
    setError(null);
    try {
      const res = await api.chat.turn({
        agent_id: selectedAgentId || null,
        agent_module: agentModule,
        agent_class: agentClass,
        llm_model: llmModel,
        agent_args: Object.keys(agentArgs).length > 0 ? agentArgs : null,
        history,
        user_input,
      });
      setHistory(res.history);
      setToolEventBatches((prev) => [...prev, res.events ?? []]);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const convertToScenario = async () => {
    setError(null);
    try {
      const now = new Date();
      const name = `Chat scenario ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const scenario = await api.scenarios.create({
        name,
        description: "Created from Chat Builder",
        agent_id: selectedAgentId || null,
        agent_module: agentModule,
        agent_class: agentClass,
        llm_model: llmModel,
        judge_model: llmModel,
        agent_args: Object.keys(agentArgs).length > 0 ? agentArgs : undefined,
        chat_history: [],
        turns: turns.map((t) => ({ user_input: t.user_input, expectations: [] })),
      });
      router.push(`/scenarios/${scenario.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="p-6 md:p-8 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link
          href="/agents"
          className={`inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ${FOCUS_LINK}`}
        >
          <ChevronLeft className="h-4 w-4" />
          Agents
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowContext((v) => !v)}>
            {showContext ? "Hide Context" : "Show Context"}
          </Button>
          <Button
            onClick={convertToScenario}
            disabled={turns.length === 0}
            variant="outline"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Convert to Scenario ({turns.length})
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm mb-4">
          {error}
        </div>
      )}
      {snapshotNotice && (
        <div className="border border-primary/20 bg-primary/5 text-foreground rounded-lg p-3 text-sm mb-4">
          {snapshotNotice}
        </div>
      )}

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-3xl space-y-6">
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                {selectedAgent ? `Ready to test ${selectedAgent.name}?` : "Ready to test your agent?"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Start a conversation. Each user message becomes a scenario turn.
              </p>
            </div>

            <div className="border rounded-2xl p-2 flex items-center gap-2 bg-card">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask anything"
                className="border-0 shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending) void send();
                  }
                }}
              />
              <Button
                onClick={send}
                disabled={sending || !draft.trim()}
                size="icon"
                className="rounded-full"
              >
                <SendHorizontal className="h-4 w-4" />
                <span className="sr-only">{sending ? "Sending" : "Send"}</span>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                {selectedAgent ? selectedAgent.name : `${agentModule}.${agentClass}`}
              </Badge>
              <Badge variant="outline">LLM: {llmModel}</Badge>
              {sourceRunId && (
                <Link
                  href={`/runs/${sourceRunId}?from=${encodeURIComponent("/agents/chat")}`}
                  className={FOCUS_LINK}
                >
                  <Badge variant="secondary">Loaded from run {sourceRunId.slice(0, 8)}...</Badge>
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                {selectedAgent ? selectedAgent.name : `${agentModule}.${agentClass}`}
              </Badge>
              <Badge variant="outline">LLM: {llmModel}</Badge>
              {sourceRunId && (
                <Link
                  href={`/runs/${sourceRunId}?from=${encodeURIComponent("/agents/chat")}`}
                  className={FOCUS_LINK}
                >
                  <Badge variant="secondary">Loaded from run {sourceRunId.slice(0, 8)}...</Badge>
                </Link>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setHistory([]);
                setToolEventBatches([]);
              }}
              disabled={history.length === 0}
            >
              New chat
            </Button>
          </div>

          <div className="flex-1 overflow-auto pr-1">
            <div className="mx-auto w-full max-w-3xl space-y-5">
              {(() => {
                let assistantIdx = -1;
                return history.map((m, idx) => {
                  const isAssistant = m.role === "assistant";
                  if (isAssistant) assistantIdx += 1;
                  const eventsForReply = isAssistant && assistantIdx >= 0 ? toolEventBatches[assistantIdx] ?? [] : [];

                  return (
                    <div key={idx} className="space-y-2">
                      {eventsForReply.length > 0 && (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] rounded-2xl border bg-muted/40 px-3 py-2 text-xs space-y-1.5">
                            {eventsForReply.map((ev, evIdx) => {
                              const type = String(ev.type ?? "event");
                              const name = ev.name ? String(ev.name) : ev.function_name ? String(ev.function_name) : null;
                              const args = ev.arguments ?? null;
                              const output = ev.output ? String(ev.output) : null;
                              const Icon = type === "function_call" ? Wrench : ArrowRightLeft;

                              return (
                                <div key={`${idx}-ev-${evIdx}`} className="space-y-1">
                                  <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="font-medium">
                                      {type === "function_call"
                                        ? `Tool call${name ? `: ${name}` : ""}`
                                        : type === "function_call_output"
                                          ? `Tool result${name ? `: ${name}` : ""}`
                                          : type.replaceAll("_", " ")}
                                    </span>
                                  </div>
                                  {args != null && (
                                    <pre className="rounded bg-background/80 p-2 text-[11px] overflow-x-auto">
                                      {typeof args === "object" ? JSON.stringify(args, null, 2) : String(args)}
                                    </pre>
                                  )}
                                  {output && (
                                    <pre className="rounded bg-background/80 p-2 text-[11px] overflow-x-auto whitespace-pre-wrap">
                                      {output}
                                    </pre>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                        <div
                          className={[
                            "max-w-[85%] rounded-3xl px-4 py-3 text-sm whitespace-pre-wrap",
                            m.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                          ].join(" ")}
                        >
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="pt-4">
            <div className="mx-auto w-full max-w-3xl border rounded-2xl p-2 flex items-center gap-2 bg-card">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask anything"
                className="border-0 shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending) void send();
                  }
                }}
              />
              <Button
                onClick={send}
                disabled={sending || !draft.trim()}
                size="icon"
                className="rounded-full"
              >
                <SendHorizontal className="h-4 w-4" />
                <span className="sr-only">{sending ? "Sending" : "Send"}</span>
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Press Enter to send.
            </p>
          </div>
        </div>
      )}

      <div
        className={[
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          showContext ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={() => setShowContext(false)}
        aria-hidden="true"
      />
      <aside
        className={[
          "fixed right-0 top-0 z-50 h-full w-full max-w-[440px] border-l bg-background",
          "transform transition-transform duration-300 ease-out",
          showContext ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-hidden={!showContext}
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-medium">Agent Context</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowContext(false)}>
              <X className="h-4 w-4" />
              <span className="sr-only">Close context</span>
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select
                value={selectedAgentId}
                onValueChange={(v) => {
                  const next = v ?? "";
                  setSelectedAgentId(next);
                  const sp = new URLSearchParams(searchParams.toString());
                  if (next) sp.set("agentId", next);
                  else sp.delete("agentId");
                  router.replace(`/agents/chat${sp.toString() ? `?${sp.toString()}` : ""}`);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an agent (recommended)">
                    {selectedAgentLabel || undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {agentOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pick an agent to auto-fill module/class, model, and default args.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-module">Agent module</Label>
              <Input
                id="agent-module"
                value={agentModule}
                onChange={(e) => setAgentModule(e.target.value)}
                placeholder="e.g. test_agents.interview_agent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-class">Agent class</Label>
              <Input
                id="agent-class"
                value={agentClass}
                onChange={(e) => setAgentClass(e.target.value)}
                placeholder="e.g. TestableInterviewAgent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-model">LLM model</Label>
              <Input
                id="llm-model"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="e.g. gpt-4o-mini"
              />
            </div>

            {selectedAgent?.arg_schema && selectedAgent.arg_schema.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <Label>Agent args</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure constructor arguments for this chat session.
                  </p>
                </div>
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-3">
                  {selectedAgent.arg_schema.map((field) => (
                    <div key={field.name} className="space-y-2">
                      <Label htmlFor={`arg-${field.name}`} className="text-sm">
                        {field.name}
                        {field.required && " *"}
                      </Label>
                      {field.type === "string" && (field.name === "interview_prompt" || field.name === "interview_context") ? (
                        <Textarea
                          id={`arg-${field.name}`}
                          value={String(agentArgs[field.name] ?? field.default ?? "")}
                          onChange={(e) =>
                            setAgentArgs((prev) => ({ ...prev, [field.name]: e.target.value || undefined }))
                          }
                          placeholder={field.default != null ? String(field.default) : undefined}
                          rows={4}
                          className="font-mono text-xs"
                        />
                      ) : field.type === "boolean" ? (
                        <Select
                          value={agentArgs[field.name] === true ? "true" : agentArgs[field.name] === false ? "false" : ""}
                          onValueChange={(v) =>
                            setAgentArgs((prev) => ({
                              ...prev,
                              [field.name]: v === "true" ? true : v === "false" ? false : undefined,
                            }))
                          }
                        >
                          <SelectTrigger id={`arg-${field.name}`}>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`arg-${field.name}`}
                          type={field.type === "integer" || field.type === "number" ? "number" : "text"}
                          value={String(agentArgs[field.name] ?? field.default ?? "")}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (field.type === "integer") {
                              setAgentArgs((prev) => ({ ...prev, [field.name]: v ? parseInt(v, 10) : undefined }));
                            } else if (field.type === "number") {
                              setAgentArgs((prev) => ({ ...prev, [field.name]: v ? parseFloat(v) : undefined }));
                            } else {
                              setAgentArgs((prev) => ({ ...prev, [field.name]: v || undefined }));
                            }
                          }}
                          placeholder={field.default != null ? String(field.default) : undefined}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Agent args</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure constructor arguments for this chat session.
                  </p>
                </div>
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-3">
                  <div className="space-y-2">
                    <Label htmlFor="candidate_name">candidate_name</Label>
                    <Input
                      id="candidate_name"
                      value={String(agentArgs["candidate_name"] ?? "")}
                      onChange={(e) =>
                        setAgentArgs((prev) => ({ ...prev, candidate_name: e.target.value || undefined }))
                      }
                      placeholder="e.g. Alice"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interview_prompt">interview_prompt</Label>
                    <Textarea
                      id="interview_prompt"
                      value={String(agentArgs["interview_prompt"] ?? "")}
                      onChange={(e) =>
                        setAgentArgs((prev) => ({ ...prev, interview_prompt: e.target.value || undefined }))
                      }
                      placeholder="## Questions\n1. Tell me about yourself..."
                      rows={4}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
