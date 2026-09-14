import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const DESIGN_THEMES = [
  {
    value: "modern",
    label: "Modern",
    description: "A calm, focused workspace with full sidebar navigation.",
    layout: "sidebar",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "A compact focused workspace with a theme-tinted icon rail.",
    layout: "sidebar-compact",
  },
  {
    value: "executive",
    label: "Executive",
    description: "An editorial workspace with light top navigation and serif headings.",
    layout: "topnav",
  },
] as const;

export type DesignTheme = (typeof DESIGN_THEMES)[number]["value"];
export type DesignThemeLayout = (typeof DESIGN_THEMES)[number]["layout"];

const STORAGE_KEY = "flow-design-theme";
const DEFAULT_THEME: DesignTheme = "modern";

function isDesignTheme(value: string | null): value is DesignTheme {
  return DESIGN_THEMES.some((theme) => theme.value === value);
}

function readStoredTheme(): DesignTheme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isDesignTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function layoutForTheme(theme: DesignTheme): DesignThemeLayout {
  return DESIGN_THEMES.find((entry) => entry.value === theme)!.layout;
}

function applyTheme(theme: DesignTheme) {
  document.documentElement.dataset.designTheme = theme;
}

const initialTheme = readStoredTheme();
applyTheme(initialTheme);

interface DesignThemeContextValue {
  theme: DesignTheme;
  layout: DesignThemeLayout;
  setTheme: (theme: DesignTheme) => void;
}

const DesignThemeContext = createContext<DesignThemeContextValue | null>(null);

export function DesignThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<DesignTheme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The theme still applies for this session when storage is unavailable.
    }
  }, [theme]);

  return (
    <DesignThemeContext.Provider value={{ theme, layout: layoutForTheme(theme), setTheme }}>
      {children}
    </DesignThemeContext.Provider>
  );
}

// The hook intentionally shares the provider module so its context stays private.
// eslint-disable-next-line react-refresh/only-export-components
export function useDesignTheme() {
  const context = useContext(DesignThemeContext);
  if (!context) {
    throw new Error("useDesignTheme must be used within DesignThemeProvider");
  }
  return context;
}
