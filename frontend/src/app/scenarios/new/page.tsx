"use client";

import { ScenarioForm } from "@/components/scenarios/scenario-form";
import Link from "next/link";
import { ChevronLeft } from "@/lib/icons";

export default function NewScenarioPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/scenarios"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Scenarios
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">New Scenario</h1>
        <p className="text-muted-foreground mt-1">
          Define conversation turns and expected agent behavior
        </p>
      </div>
      <ScenarioForm />
    </div>
  );
}
