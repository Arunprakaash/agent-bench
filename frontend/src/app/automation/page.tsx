"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type RegressionAlert, type ScenarioListItem, type ScheduledRun, type SuiteListItem } from "@/lib/api";
import { formatDate } from "@/lib/table-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { Clock, Trash2 } from "@/lib/icons";

export default function AutomationPage() {
  const { setItems } = useBreadcrumbs();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduledRun[]>([]);
  const [alerts, setAlerts] = useState<RegressionAlert[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [suites, setSuites] = useState<SuiteListItem[]>([]);

  const [targetType, setTargetType] = useState<"scenario" | "suite">("scenario");
  const [scenarioId, setScenarioId] = useState<string>("");
  const [suiteId, setSuiteId] = useState<string>("");
  const [intervalMinutes, setIntervalMinutes] = useState("1440");
  const [creating, setCreating] = useState(false);

  const scenarioOptions = useMemo(() => scenarios.map((s) => ({ value: s.id, label: s.name })), [scenarios]);
  const suiteOptions = useMemo(() => suites.map((s) => ({ value: s.id, label: s.name })), [suites]);
  const selectedScenarioLabel = useMemo(
    () => scenarioOptions.find((opt) => opt.value === scenarioId)?.label,
    [scenarioOptions, scenarioId],
  );
  const selectedSuiteLabel = useMemo(
    () => suiteOptions.find((opt) => opt.value === suiteId)?.label,
    [suiteOptions, suiteId],
  );
  const scenarioNameById = useMemo(
    () => new Map(scenarios.map((s) => [s.id, s.name])),
    [scenarios],
  );
  const suiteNameById = useMemo(
    () => new Map(suites.map((s) => [s.id, s.name])),
    [suites],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSchedules, nextAlerts, nextScenarios, nextSuites] = await Promise.all([
        api.automation.listSchedules(),
        api.automation.listAlerts(false),
        api.scenarios.list(),
        api.suites.list(),
      ]);
      setSchedules(nextSchedules);
      setAlerts(nextAlerts);
      setScenarios(nextScenarios);
      setSuites(nextSuites);
    } catch (e) {
      setError((e as Error).message || "Failed to load automation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setItems([{ label: "Automation" }]);
    void load();
  }, [setItems]);

  const createSchedule = async () => {
    const interval = Number(intervalMinutes);
    if (!Number.isFinite(interval) || interval < 5) {
      setError("Interval must be at least 5 minutes.");
      return;
    }
    if (targetType === "scenario" && !scenarioId) {
      setError("Select a scenario.");
      return;
    }
    if (targetType === "suite" && !suiteId) {
      setError("Select a suite.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await api.automation.createSchedule({
        target_type: targetType,
        scenario_id: targetType === "scenario" ? scenarioId : undefined,
        suite_id: targetType === "suite" ? suiteId : undefined,
        interval_minutes: interval,
      });
      await load();
    } catch (e) {
      setError((e as Error).message || "Failed to create schedule.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automation</h1>
        <p className="text-muted-foreground mt-1">Scheduled runs and regression alerts.</p>
      </div>

      {error && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      <div className="border rounded-lg p-5 space-y-6">
        <div>
          <h2 className="text-base font-semibold">Create schedule</h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Pick a scenario or suite and run it automatically at a fixed interval.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Target type</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as "scenario" | "suite")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scenario">Scenario</SelectItem>
                <SelectItem value="suite">Suite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-5">
            <Label>{targetType === "scenario" ? "Scenario" : "Suite"}</Label>
            {targetType === "scenario" ? (
              <Select value={scenarioId} onValueChange={setScenarioId}>
                <SelectTrigger className="w-full">
                  <SelectValue className="sr-only" placeholder="Select scenario" />
                  <span className="line-clamp-1">
                    {selectedScenarioLabel ?? "Select scenario"}
                  </span>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {scenarioOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={suiteId} onValueChange={setSuiteId}>
                <SelectTrigger className="w-full">
                  <SelectValue className="sr-only" placeholder="Select suite" />
                  <span className="line-clamp-1">
                    {selectedSuiteLabel ?? "Select suite"}
                  </span>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {suiteOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Interval (minutes)</Label>
            <Input value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <Button onClick={createSchedule} disabled={creating}>
            <Clock className="mr-2 h-4 w-4" />
            {creating ? "Creating..." : "Create Schedule"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden">
          <div className="p-4 border-b font-medium">Schedules</div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : schedules.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No schedules yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Every</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.target_type === "scenario"
                        ? scenarioNameById.get(s.scenario_id ?? "") ?? "Scenario"
                        : suiteNameById.get(s.suite_id ?? "") ?? "Suite"}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {s.target_type}
                    </TableCell>
                    <TableCell>{s.interval_minutes}m</TableCell>
                    <TableCell>{formatDate(s.next_run_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await api.automation.deleteSchedule(s.id);
                          await load();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="p-4 border-b font-medium">Regression alerts</div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No open alerts.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.title}</div>
                      {a.detail && <div className="text-xs text-muted-foreground">{a.detail}</div>}
                      <Link href={`/runs/${a.run_id}`} className="text-xs text-primary hover:underline">
                        View run
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(a.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await api.automation.acknowledgeAlert(a.id);
                          await load();
                        }}
                      >
                        Acknowledge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

