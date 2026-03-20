"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type ScenarioListItem, type Suite } from "@/lib/api";
import { formatDate, paginate, DEFAULT_PAGE_SIZE } from "@/lib/table-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "@/lib/icons";
import { useBreadcrumbs } from "@/components/layout/breadcrumb-context";
import { TablePagination } from "@/components/table-pagination";

export default function CreateSuitePage() {
  const router = useRouter();
  const { setItems } = useBreadcrumbs();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [scenariosError, setScenariosError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setItems([{ label: "Suites", href: "/suites" }, { label: "Create" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoadingScenarios(true);
    setScenariosError(null);
    void api.scenarios
      .list()
      .then((data) => setScenarios(data))
      .catch((e) => setScenariosError((e as Error).message || "Failed to load scenarios."))
      .finally(() => setLoadingScenarios(false));
  }, []);

  const filteredScenarios = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return scenarios;
    return scenarios.filter((s) => {
      return s.name.toLowerCase().includes(query) || (s.description || "").toLowerCase().includes(query);
    });
  }, [scenarios, q]);

  const pagedScenarios = useMemo(
    () => paginate(filteredScenarios, page, pageSize),
    [filteredScenarios, page, pageSize],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredScenarios.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [filteredScenarios.length, page, pageSize]);

  const toggleScenario = (id: string) => {
    setSelectedScenarioIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreateError(null);
    setCreating(true);
    try {
      const suite: Suite = await api.suites.create({
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        scenario_ids: Array.from(selectedScenarioIds),
      });
      router.push(`/suites/${suite.id}`);
    } catch (e) {
      setCreateError((e as Error).message || "Failed to create suite.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Suite</h1>
          <p className="text-muted-foreground mt-1">Group scenarios into a reusable test suite.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/suites")} disabled={creating}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>

      {createError && (
        <div className="border border-destructive/20 bg-destructive/5 text-destructive rounded-lg p-4 text-sm">
          {createError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6 items-start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="suite-create-name">Name</Label>
            <Input
              id="suite-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Regression Suite"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suite-create-desc">Description</Label>
            <Textarea
              id="suite-create-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this suite covers..."
              rows={4}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            Optionally select scenarios to include in the suite. Leave it empty to create an empty suite.
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="p-4 border-b flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                <Input
                  placeholder="Search scenarios..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {loadingScenarios ? (
              <div className="p-6 text-sm text-muted-foreground">Loading scenarios...</div>
            ) : scenariosError ? (
              <div className="p-6 text-sm text-destructive">{scenariosError}</div>
            ) : (
              <>
                <TablePagination
                  totalItems={filteredScenarios.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={(p) => setPage(p)}
                  onPageSizeChange={(s) => {
                    setPage(1);
                    setPageSize(s);
                  }}
                  pageSizeOptions={[5, 10, 20, 50]}
                />

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[44px]">Use</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[160px] text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedScenarios.map((s) => {
                      const checked = selectedScenarioIds.has(s.id);
                      return (
                        <TableRow key={s.id} className="align-top">
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleScenario(s.id)}
                              aria-label={`Include scenario ${s.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{s.name}</div>
                            {s.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {s.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDate(s.updated_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {filteredScenarios.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <div className="p-6 text-sm text-muted-foreground">No scenarios match your search.</div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">Suite summary</div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedScenarioIds.size}</span> scenario
              {selectedScenarioIds.size !== 1 ? "s" : ""} selected
            </div>
            <div className="text-xs text-muted-foreground">
              Select scenarios if you want them included in the suite right away. Leaving all unchecked creates the suite with no scenarios.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

