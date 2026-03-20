"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type AgentCreate } from "@/lib/api";
import { AGENT_MODEL_OPTIONS } from "@/lib/agent-models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft } from "@/lib/icons";

/** Suggested default args when module/class is the interview agent (pre-filled so "default args" are visible by default). */
const INTERVIEW_AGENT_DEFAULT_ARGS = {
  candidate_name: "Candidate",
  agent_name: "Sia",
};

const DEFAULT_ARGS_INITIAL = JSON.stringify(INTERVIEW_AGENT_DEFAULT_ARGS, null, 2);

export default function NewAgentPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("test_agents.interview_agent");
  const [agentClass, setAgentClass] = useState("TestableInterviewAgent");
  const [defaultLlmModel, setDefaultLlmModel] = useState<string>("gpt-4o-mini");
  const [defaultJudgeModel, setDefaultJudgeModel] = useState<string>("gpt-4o-mini");
  const [defaultArgsText, setDefaultArgsText] = useState(DEFAULT_ARGS_INITIAL);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    let default_agent_args: Record<string, unknown> = {};
    try {
      default_agent_args = defaultArgsText.trim()
        ? (JSON.parse(defaultArgsText) as Record<string, unknown>)
        : {};
    } catch (err) {
      setError(`Default agent args: invalid JSON — ${(err as Error).message}`);
      return;
    }

    const payload: AgentCreate = {
      name: name.trim(),
      description: description.trim() || undefined,
      module: module.trim(),
      agent_class: agentClass.trim(),
      default_llm_model: defaultLlmModel,
      default_judge_model: defaultJudgeModel,
      default_agent_args: Object.keys(default_agent_args).length ? default_agent_args : {},
    };

    setSubmitting(true);
    try {
      const created = await api.agents.create(payload);
      router.push(`/agents/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Agents
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">Create Agent</h1>
        <p className="text-muted-foreground mt-1">
          Add a new agent entrypoint and defaults for scenarios and Chat Builder.
        </p>
      </div>

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="agent-name">Name</Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Interview Agent"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-desc">Description</Label>
          <Textarea
            id="agent-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-module">Module</Label>
            <Input
              id="agent-module"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="e.g. test_agents.interview_agent"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-class">Class</Label>
            <Input
              id="agent-class"
              value={agentClass}
              onChange={(e) => setAgentClass(e.target.value)}
              placeholder="e.g. TestableInterviewAgent"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-llm">Default LLM model</Label>
            <Select value={defaultLlmModel} onValueChange={(v) => v && setDefaultLlmModel(v)}>
              <SelectTrigger id="agent-llm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-judge">Default judge model</Label>
            <Select value={defaultJudgeModel} onValueChange={(v) => v && setDefaultJudgeModel(v)}>
              <SelectTrigger id="agent-judge" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-args">Default agent args (JSON)</Label>
          <Textarea
            id="agent-args"
            value={defaultArgsText}
            onChange={(e) => setDefaultArgsText(e.target.value)}
            rows={6}
            className="font-mono text-sm"
            placeholder="{}"
          />
          <p className="text-xs text-muted-foreground">
            Optional JSON object passed to the agent constructor. Use <code className="rounded bg-muted px-1">{"{}"}</code> for no
            defaults.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Agent"}
          </Button>
          <Link
            href="/agents"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-sm"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
