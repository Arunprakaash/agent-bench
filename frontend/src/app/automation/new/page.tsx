"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type ScenarioListItem, type SuiteListItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";

export default function NewAutomationSchedulePage() {
  const router = useRouter();
  const { setItems } = useBreadcrumbs();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [suites, setSuites] = useState<SuiteListItem[]>([]);

  const [targetType, setTargetType] = useState<"scenario" | "suite">("scenario");
  const [scenarioId, setScenarioId] = useState("");
  const [suiteId, setSuiteId] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("1440");

  useEffect(() => {
    setItems([{ label: "Automation", href: "/automation" }, { label: "Create" }]);
    void Promise.all([api.scenarios.list(), api.suites.list()]).then(([sc, su]) => {
      setScenarios(sc);
      setSuites(su);
    });
  }, [setItems]);

  const scenarioOptions = useMemo(() => scenarios.map((s) => ({ value: s.id, label: s.name })), [scenarios]);
  const suiteOptions = useMemo(() => suites.map((s) => ({ value: s.id, label: s.name })), [suites]);

  const onCreate = async () => {
    const interval = Number(intervalMinutes);
    if (!Number.isFinite(interval) || interval < 5) {
      setError("Interval must be at least 5 minutes.");
      return;
    }
    if (targetType === "scenario" && !scenarioId) return setError("Select a scenario.");
    if (targetType === "suite" && !suiteId) return setError("Select a suite.");
    setSaving(true);
    setError(null);
    try {
      await api.automation.createSchedule({
        target_type: targetType,
        scenario_id: targetType === "scenario" ? scenarioId : undefined,
        suite_id: targetType === "suite" ? suiteId : undefined,
        interval_minutes: interval,
      });
      router.push("/automation");
    } catch (e) {
      setError((e as Error).message || "Failed to create schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Schedule</h1>
          <p className="text-muted-foreground mt-1">Add an automated scenario or suite run.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/automation"><Button variant="outline">Cancel</Button></Link>
          <Button onClick={onCreate} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
        </div>
      </div>

      {error && <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">{error}</div>}

      <div className="border rounded-lg p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Target type</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as "scenario" | "suite")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scenario">Scenario</SelectItem>
                <SelectItem value="suite">Suite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{targetType === "scenario" ? "Scenario" : "Suite"}</Label>
            {targetType === "scenario" ? (
              <Select value={scenarioId} onValueChange={setScenarioId}>
                <SelectTrigger><SelectValue placeholder="Select scenario" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {scenarioOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Select value={suiteId} onValueChange={setSuiteId}>
                <SelectTrigger><SelectValue placeholder="Select suite" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {suiteOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Interval (minutes)</Label>
            <Input value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

