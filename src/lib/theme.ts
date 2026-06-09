export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "cryptopay-theme";

export const themeOptions: Array<{ id: ThemeChoice; label: string }> = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "light";

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "dark" || saved === "light" || saved === "system") return saved;
  return "light";
}

export function resolveThemeChoice(choice: ThemeChoice) {
  if (choice !== "system") return choice;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeChoice(choice: ThemeChoice) {
  if (typeof document === "undefined") return;

  const resolved = resolveThemeChoice(choice);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function persistThemeChoice(choice: ThemeChoice) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  applyThemeChoice(choice);
}
