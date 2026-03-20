"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
import { ChevronLeft, SendHorizontal, Wand2 } from "@/lib/icons";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

export default function ScenarioChatBuilderPage() {
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
      <ScenarioChatBuilderInner />
    </Suspense>
  );
}

function ScenarioChatBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentIdFromUrl = searchParams.get("agentId") ?? "";

  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agentIdFromUrl);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const [agentModule, setAgentModule] = useState("test_agents.interview_agent");
  const [agentClass, setAgentClass] = useState("TestableInterviewAgent");
  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [agentArgsText, setAgentArgsText] = useState<string>(
    JSON.stringify(
      {
        candidate_name: "Alice",
        interview_prompt:
          "## Questions\n1. Tell me about yourself\n2. What is your experience with Python?",
      },
      null,
      2,
    ),
  );

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);

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
        setAgentModule(a.module);
        setAgentClass(a.agent_class);
        setLlmModel(a.default_llm_model);
        setAgentArgsText(JSON.stringify(a.default_agent_args || {}, null, 2));
        setHistory([]);
      })
      .catch(() => setSelectedAgent(null));
  }, [selectedAgentId]);

  const turns = useMemo(() => {
    // Build turns from user messages; expectations are intentionally empty for MVP.
    const t: Array<{ user_input: string }> = [];
    for (const msg of history) {
      if (msg.role === "user") t.push({ user_input: msg.content });
    }
    return t;
  }, [history]);

  const send = async () => {
    const user_input = draft.trim();
    if (!user_input) return;

    setSending(true);
    setError(null);
    try {
      const agent_args = agentArgsText.trim() ? (JSON.parse(agentArgsText) as Record<string, unknown>) : null;
      const res = await api.chat.turn({
        agent_id: selectedAgentId || null,
        agent_module: agentModule,
        agent_class: agentClass,
        llm_model: llmModel,
        agent_args,
        history,
        user_input,
      });
      setHistory(res.history);
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
      const agent_args = agentArgsText.trim() ? (JSON.parse(agentArgsText) as Record<string, unknown>) : undefined;
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
        agent_args,
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
          href="/scenarios"
          className={`inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ${FOCUS_LINK}`}
        >
          <ChevronLeft className="h-4 w-4" />
          Scenarios
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

      {showContext && (
        <div className="mb-4 border rounded-xl p-4 space-y-4">
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
                router.replace(`/scenarios/chat${sp.toString() ? `?${sp.toString()}` : ""}`);
              }}
            >
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select an agent (recommended)" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
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

          <div className="grid gap-3 md:grid-cols-3">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-args">Agent args (JSON)</Label>
            <Textarea
              id="agent-args"
              value={agentArgsText}
              onChange={(e) => setAgentArgsText(e.target.value)}
              rows={6}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm mb-4">
          {error}
        </div>
      )}

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-3xl space-y-6">
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                {selectedAgent ? `Hey, ${selectedAgent.name}. Ready to dive in?` : "Ready to test your agent?"}
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
            </div>
            <Button
              variant="ghost"
              onClick={() => setHistory([])}
              disabled={history.length === 0}
            >
              New chat
            </Button>
          </div>

          <div className="flex-1 overflow-auto pr-1 space-y-5">
            {history.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
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
            ))}
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
    </div>
  );
}

