/** Prompt workflow styles shown on the submit form. */
export const PROMPT_STYLES = [
  {
    id: "one_shot",
    label: "One-shot",
    hint: "Single prompt → finished result",
    needsPrompt: true,
  },
  {
    id: "few_shot",
    label: "Few-shot / examples",
    hint: "Prompt plus examples or templates",
    needsPrompt: true,
  },
  {
    id: "multi_turn",
    label: "Multi-turn chat",
    hint: "Back-and-forth conversation",
    needsPrompt: true,
  },
  {
    id: "iterative",
    label: "Iterative refine",
    hint: "Many small prompt tweaks",
    needsPrompt: true,
  },
  {
    id: "agentic",
    label: "Agent / tool loop",
    hint: "Agent ran tools over several steps",
    needsPrompt: true,
  },
  {
    id: "spec_driven",
    label: "Spec / PRD driven",
    hint: "Started from a written spec",
    needsPrompt: true,
  },
  {
    id: "vibe",
    label: "Vibe coding",
    hint: "Loose direction, lots of iteration",
    needsPrompt: true,
  },
  {
    id: "visual_first",
    label: "Visual → code",
    hint: "Screenshot, mock, or image first",
    needsPrompt: true,
  },
  {
    id: "multi_day",
    label: "Long multi-day process",
    hint: "No single prompt — many sessions",
    needsPrompt: false,
  },
  {
    id: "other",
    label: "Other",
    hint: "Something else — describe in prompt",
    needsPrompt: true,
  },
] as const;

export type PromptStyleId = (typeof PROMPT_STYLES)[number]["id"];

export function promptStyleNeedsText(id: string): boolean {
  const found = PROMPT_STYLES.find((s) => s.id === id);
  return found ? found.needsPrompt : true;
}

export function promptStyleLabel(id: string): string {
  return PROMPT_STYLES.find((s) => s.id === id)?.label ?? id;
}

/**
 * Popular coding / AI models people test with.
 * Newest first within each family. "Other" opens free-text.
 */
export const CODING_MODELS = [
  // xAI / Grok (latest first)
  "Grok 4.5",
  "Grok 4",
  "Grok 4 Code",
  "Grok 3",
  "Grok 3 Mini",
  "Grok Code Fast",
  // Anthropic
  "Claude Opus 4.1",
  "Claude Opus 4",
  "Claude Sonnet 4",
  "Claude 3.7 Sonnet",
  "Claude 3.5 Sonnet",
  "Claude Haiku 3.5",
  // OpenAI
  "GPT-5",
  "GPT-5 mini",
  "GPT-4.1",
  "GPT-4.1 mini",
  "GPT-4o",
  "o3",
  "o4-mini",
  "o3-mini",
  "Codex",
  // Google
  "Gemini 2.5 Pro",
  "Gemini 2.5 Flash",
  "Gemini 2.0 Flash",
  // Open / Chinese labs
  "DeepSeek R1",
  "DeepSeek V3",
  "DeepSeek Coder",
  "Qwen 3 Coder",
  "Qwen 2.5 Coder",
  "Llama 4",
  "Llama 3.3",
  "Kimi K2",
  // Coding products / agents
  "Cursor Agent",
  "GitHub Copilot",
  "Windsurf Cascade",
  "Devin",
  "Codex CLI",
  "Aider",
  "Cline",
  "Other",
] as const;

/**
 * Quick-add tool / harness suggestions for the pill input.
 * Grok Build + agent harnesses first, then IDEs and stack.
 */
export const TOOL_SUGGESTIONS = [
  // Grok / xAI
  "Grok Build web",
  "Grok Build CLI",
  "Grok",
  "Grok Chat",
  // Agent harnesses & coding agents
  "Claude Code",
  "Codex",
  "Codex CLI",
  "Hermes",
  "Cursor",
  "Cursor Agent",
  "Windsurf",
  "Cascade",
  "Cline",
  "Aider",
  "Devin",
  "OpenHands",
  "SWE-agent",
  "Continue",
  "Roo Code",
  "Goose",
  "Amp",
  "Replit Agent",
  "v0",
  "Lovable",
  "Bolt",
  // IDEs & assistants
  "VS Code",
  "GitHub Copilot",
  "JetBrains AI",
  "Zed",
  "Neovim",
  // Models-as-tools
  "Claude",
  "ChatGPT",
  "Gemini",
  // Design / media
  "Figma",
  "Midjourney",
  "Flux",
  "Blender",
  // Stack
  "React",
  "Next.js",
  "Vite",
  "TanStack",
  "Tailwind",
  "TypeScript",
  "Python",
  "Three.js",
  "Playwright",
  "GitHub",
  "Vercel",
  "Docker",
] as const;

/** Ensure a user-typed URL is a valid absolute http(s) URL. */

/** App categories — one-click pick on submit / filter on showcase. */
export const SHOWCASE_CATEGORIES = [
  { id: "games", label: "Games", hint: "Playable games & toys" },
  { id: "utility", label: "Utilities", hint: "Tools, calculators, helpers" },
  { id: "harness", label: "Harness", hint: "Agent harnesses & coding agents" },
  { id: "design", label: "Design tools", hint: "UI, mockups, design systems" },
  { id: "image", label: "Image tools", hint: "Image gen, edit, vision" },
  { id: "video", label: "Video tools", hint: "Video gen, edit, motion" },
  { id: "audio", label: "Audio tools", hint: "Music, voice, sound" },
  { id: "chat", label: "Chat & social", hint: "Chatbots, communities, social" },
  { id: "productivity", label: "Productivity", hint: "Notes, tasks, workflows" },
  { id: "dev_tools", label: "Dev tools", hint: "IDE helpers, CLIs, debug" },
  { id: "data", label: "Data & analytics", hint: "Charts, dashboards, ETL" },
  { id: "education", label: "Education", hint: "Learning, courses, quizzes" },
  { id: "landing", label: "Landing pages", hint: "Marketing & launch sites" },
  { id: "portfolio", label: "Portfolio", hint: "Personal / project sites" },
  { id: "3d", label: "3D & creative", hint: "3D scenes, art, generative" },
  { id: "automation", label: "Automation", hint: "Bots, agents, workflows" },
  { id: "other", label: "Other", hint: "Doesn't fit the rest" },
] as const;

export type ShowcaseCategoryId = (typeof SHOWCASE_CATEGORIES)[number]["id"];

export function isShowcaseCategory(id: string): id is ShowcaseCategoryId {
  return SHOWCASE_CATEGORIES.some((c) => c.id === id);
}

export function categoryLabel(id: string): string {
  return SHOWCASE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function normalizeHttpUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return value;
  value = value.replace(/^['"]|['"]$/g, "");
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
  }
  return value;
}
