// Theme preference: "light", "dark", or "system" (follow the OS setting).
// Stored in localStorage (read by the inline script before first paint) and
// on users/{uid}.theme in Firestore.

export const THEME_STORAGE_KEY = "theme";

export const THEME_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

// Older accounts stored one of ten named themes ("theme-blue-dark",
// "theme-gold-light", ...). Map those onto light/dark instead of migrating.
export function normalizeTheme(value) {
  if (value === "light" || value === "dark" || value === "system") return value;
  if (typeof value === "string" && value.endsWith("-dark")) return "dark";
  if (typeof value === "string" && value.endsWith("-light")) return "light";
  return "system";
}

// "system" leaves data-theme unset so the prefers-color-scheme rules in
// globals.css decide.
export function applyTheme(preference) {
  const theme = normalizeTheme(preference);
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
  return theme;
}

// Runs in <head> before first paint. Keep the mapping in sync with
// normalizeTheme above.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"";if(/-dark$/.test(t))t="dark";else if(/-light$/.test(t))t="light";if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
