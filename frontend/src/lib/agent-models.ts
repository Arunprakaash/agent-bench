/** Model options for agent default LLM and judge dropdowns */
export const AGENT_MODEL_OPTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
] as const;

export type AgentModelOption = (typeof AGENT_MODEL_OPTIONS)[number];
