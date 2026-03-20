"use client";

import type React from "react";
import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs";

type BreadcrumbContextValue = {
  items: BreadcrumbItem[];
  setItems: (next: BreadcrumbItem[]) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[]>([]);
  const pathname = usePathname();

  // Clear breadcrumbs when navigating so we don't show stale hierarchy.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([]);
  }, [pathname]);

  const value = useMemo(() => ({ items, setItems }), [items]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbs() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error("useBreadcrumbs must be used within BreadcrumbsProvider");
  return ctx;
}

