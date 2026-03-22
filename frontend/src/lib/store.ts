import { create } from "zustand";
import { api, type ScenarioListItem, type TestRunListItem } from "./api";

interface AppState {
  scenarios: ScenarioListItem[];
  runs: TestRunListItem[];
  loading: boolean;
  error: string | null;

  fetchScenarios: (params?: { workspace_id?: string | null }) => Promise<void>;
  fetchRuns: (params?: { scenario_id?: string; suite_id?: string; status?: string; limit?: number; workspace_id?: string | null }) => Promise<void>;
  clearError: () => void;
}

export const useStore = create<AppState>((set) => ({
  scenarios: [],
  runs: [],
  loading: false,
  error: null,

  fetchScenarios: async (params) => {
    set({ loading: true, error: null });
    try {
      const scenarios = await api.scenarios.list(undefined, params?.workspace_id);
      set({ scenarios, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchRuns: async (params) => {
    set({ loading: true, error: null });
    try {
      const runs = await api.runs.list(params);
      set({ runs, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
