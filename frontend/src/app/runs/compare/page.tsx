"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, type TestRun, type TestRunListItem, type TurnResult } from "@/lib/api";
import { formatDateTime, formatDuration } from "@/lib/table-helpers";
import { getParam, setOrDelete, withFrom } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "@/lib/icons";

const FOCUS_LINK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

export default function RunComparePage() {
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
      <RunCompareInner />
    </Suspense>
  );
}

function RunCompareInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const runAFromUrl = getParam(searchParams, "runA") ?? "";
  const runBFromUrl = getParam(searchParams, "runB") ?? "";
  const from = getParam(searchParams, "from") ?? "/runs";

  const [runAId, setRunAId] = useState(runAFromUrl);
  const [runBId, setRunBId] = useState(runBFromUrl);
  const [runA, setRunA] = useState<TestRun | null>(null);
  const [runB, setRunB] = useState<TestRun | null>(null);
  const [runsForScenario, setRunsForScenario] = useState<TestRunListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTurn, setSelectedTurn] = useState(0);
  const [filter, setFilter] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setRunAId(runAFromUrl);
    setRunBId(runBFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runAFromUrl, runBFromUrl]);

  const syncUrl = useCallback(
    (next: { runA?: string; runB?: string; from?: string }) => {
      const sp = new URLSearchParams(searchParams.toString());
      setOrDelete(sp, "runA", next.runA);
      setOrDelete(sp, "runB", next.runB);
      setOrDelete(sp, "from", next.from && next.from !== "/runs" ? next.from : null);
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!runAId || !runBId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const [a, b] = await Promise.all([api.runs.get(runAId), api.runs.get(runBId)]);
        if (cancelled) return;
        setRunA(a);
        setRunB(b);
        setSelectedTurn(0);
      } catch (e) {
        if (!cancelled) {
          setLoadError((e as Error).message || "Failed to load runs.");
          setRunA(null);
          setRunB(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [runAId, runBId]);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      if (!runAId) return;
      setLoadError(null);
      try {
        const a = await api.runs.get(runAId);
        if (cancelled) return;
        const list = await api.runs.list({ scenario_id: a.scenario_id, limit: 200 });
        if (cancelled) return;
        setRunsForScenario(list);
      } catch (e) {
        if (!cancelled) {
          setLoadError((e as Error).message || "Failed to load run options.");
          setRunsForScenario([]);
        }
      }
    }
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [runAId]);

  const filteredOptions = useMemo(() => {
    if (!filter) return runsForScenario;
    const q = filter.toLowerCase();
    return runsForScenario.filter((r) => {
      const d = new Date(r.created_at).toISOString();
      return `${r.id} ${r.status} ${d}`.toLowerCase().includes(q);
    });
  }, [runsForScenario, filter]);

  const turnCount = Math.max(runA?.turn_results.length || 0, runB?.turn_results.length || 0);
  const aTurn = runA?.turn_results[selectedTurn] ?? null;
  const bTurn = runB?.turn_results[selectedTurn] ?? null;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compare Runs</h1>
          <p className="text-muted-foreground mt-1">
            Side-by-side diff of turns, events, and verdicts
          </p>
        </div>

        {runA && (
          <div className="flex items-center gap-2">
            <Link
              href={withFrom(`/runs/${runA.id}`, from)}
              className={`text-sm text-primary hover:underline ${FOCUS_LINK}`}
            >
              Open Run A
            </Link>
            <span className="text-muted-foreground">·</span>
            {runB && (
              <Link
                href={withFrom(`/runs/${runB.id}`, from)}
                className={`text-sm text-primary hover:underline ${FOCUS_LINK}`}
              >
                Open Run B
              </Link>
            )}
          </div>
        )}
      </div>

      {loadError && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {loadError}{" "}
          <span className="text-muted-foreground">
            (Check `NEXT_PUBLIC_API_URL` and that the backend is running.)
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Run A</p>
            <Select
              value={runAId}
              onValueChange={(v) => {
                const next = v ?? "";
                setRunAId(next);
                syncUrl({ runA: next, runB: runBId, from });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select run A" />
              </SelectTrigger>
              <SelectContent>
                {filteredOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {formatDateTime(r.created_at)} · {r.status} · {r.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
              <Input
                className="pl-9"
                placeholder="Filter runs…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            {runA && <RunMeta run={runA} />}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Run B</p>
            <Select
              value={runBId}
              onValueChange={(v) => {
                const next = v ?? "";
                setRunBId(next);
                syncUrl({ runA: runAId, runB: next, from });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select run B" />
              </SelectTrigger>
              <SelectContent>
                {filteredOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {formatDateTime(r.created_at)} · {r.status} · {r.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {runB && <RunMeta run={runB} />}
          </CardContent>
        </Card>
      </div>

      {!runAId || !runBId ? (
        <div className="border rounded-lg p-10 text-center text-muted-foreground">
          Select two runs to compare.
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !runA || !runB ? (
        <div className="border rounded-lg p-10 text-center text-muted-foreground">
          Unable to load both runs.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 min-h-[520px]">
          <div className="col-span-12 lg:col-span-4 border rounded-lg overflow-hidden">
            <div className="border-b bg-primary/[0.02] px-3 py-2.5 flex items-center justify-between">
              <p className="text-sm font-medium">Turns</p>
              <p className="text-xs text-muted-foreground">{turnCount} total</p>
            </div>
            <div className="divide-y">
              {Array.from({ length: turnCount }, (_, idx) => {
                const a = runA.turn_results[idx] ?? null;
                const b = runB.turn_results[idx] ?? null;
                const diff = turnDiff(a, b);
                const active = idx === selectedTurn;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedTurn(idx)}
                    className={`w-full text-left px-3 py-2.5 transition-colors ${
                      active ? "bg-primary/[0.06]" : "hover:bg-primary/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">Turn {idx + 1}</span>
                      {diff.changed ? (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          changed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-300">
                          same
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {a?.user_input || b?.user_input || "-"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      A: {a ? `${a.events.length} events` : "—"} · B: {b ? `${b.events.length} events` : "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TurnPanel label="Run A" turn={aTurn} accent="brand" />
              <TurnPanel label="Run B" turn={bTurn} accent="danger" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RunMeta({ run }: { run: TestRun }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="text-xs">status: {run.status}</Badge>
      {run.duration_ms != null && <Badge variant="outline" className="text-xs">dur: {formatDuration(run.duration_ms)}</Badge>}
      <Badge variant="outline" className="text-xs">turns: {run.turn_results.length}</Badge>
    </div>
  );
}

function TurnPanel({
  label,
  turn,
  accent,
}: {
  label: string;
  turn: TurnResult | null;
  accent: "brand" | "danger";
}) {
  const assistantMessage = (() => {
    if (!turn?.events?.length) return null;
    for (const ev of turn.events) {
      if (!ev || typeof ev !== "object") continue;
      const role = typeof ev["role"] === "string" ? ev["role"] : null;
      const content = typeof ev["content"] === "string" ? ev["content"] : null;
      const output = typeof ev["output"] === "string" ? ev["output"] : null;
      if (role === "assistant" && content && content.trim()) {
        const s = content.trim();
        return s.length > 320 ? `${s.slice(0, 320)}…` : s;
      }
      if (output && output.trim()) {
        // Fallback for cases where the event stores the assistant message in `output`.
        const s = output.trim();
        return s.length > 320 ? `${s.slice(0, 320)}…` : s;
      }
    }
    return null;
  })();

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="border-b bg-primary/[0.02] px-3 py-2.5 flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{turn ? `Turn ${turn.turn_index + 1}` : "—"}</p>
      </div>
      {!turn ? (
        <div className="p-4 text-sm text-muted-foreground">No data.</div>
      ) : (
        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">User input</p>
            <p className="mt-1 text-sm bg-muted/30 rounded-md p-2 break-words">
              {turn.user_input}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Assistant message</p>
            <p className="mt-1 text-sm bg-muted/30 rounded-md p-2 break-words">
              {assistantMessage ? assistantMessage : "—"}
            </p>
          </div>
          <div className="grid gap-3">
            <Kvp k="Passed" v={turn.passed == null ? "—" : turn.passed ? "Yes" : "No"} accent={accent} />
            <Kvp k="Latency" v={turn.latency_ms != null ? formatDuration(turn.latency_ms) : "—"} accent={accent} />
            <Kvp k="Events" v={String(turn.events.length)} accent={accent} />
            <Kvp k="Verdicts" v={turn.judge_verdicts ? String(turn.judge_verdicts.length) : "—"} accent={accent} />
          </div>
          {turn.error_message && (
            <div className="bg-red-50 dark:bg-red-950/20 rounded-md p-2 text-xs text-red-700 dark:text-red-300 break-words">
              {turn.error_message}
            </div>
          )}
          <details className="group">
            <summary className="text-xs font-medium text-primary cursor-pointer select-none">
              Events JSON
            </summary>
            <pre className="mt-2 text-xs font-mono bg-muted/30 rounded-md p-2 overflow-auto max-h-64">
              {JSON.stringify(turn.events, null, 2)}
            </pre>
          </details>
          {turn.judge_verdicts && (
            <details className="group">
              <summary className="text-xs font-medium text-primary cursor-pointer select-none">
                Verdicts JSON
              </summary>
              <pre className="mt-2 text-xs font-mono bg-muted/30 rounded-md p-2 overflow-auto max-h-64">
                {JSON.stringify(turn.judge_verdicts, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Kvp({ k, v, accent }: { k: string; v: string; accent: "brand" | "danger" }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="text-xs font-medium tabular-nums text-foreground">
        {v}
      </span>
    </div>
  );
}

function turnDiff(a: TurnResult | null, b: TurnResult | null) {
  if (!a && !b) return { changed: false };
  if (!a || !b) return { changed: true };
  const user = a.user_input !== b.user_input;
  const passed = a.passed !== b.passed;
  const events = JSON.stringify(a.events) !== JSON.stringify(b.events);
  const verdicts = JSON.stringify(a.judge_verdicts ?? null) !== JSON.stringify(b.judge_verdicts ?? null);
  return { changed: user || passed || events || verdicts };
}

