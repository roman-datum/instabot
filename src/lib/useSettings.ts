"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Lang } from "./i18n";
import React from "react";

type Theme = "dark" | "light";

interface SettingsCtx {
  lang: Lang;
  theme: Theme;
  toggleLang: () => void;
  toggleTheme: () => void;
}

const Ctx = createContext<SettingsCtx>({
  lang: "en", theme: "dark", toggleLang: () => {}, toggleTheme: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedLang = localStorage.getItem("bm_lang") as Lang | null;
    const savedTheme = localStorage.getItem("bm_theme") as Theme | null;
    if (savedLang) setLangState(savedLang);
    if (savedTheme) setThemeState(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme || "dark");
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("bm_lang", l);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("bm_theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const toggleLang = useCallback(() => setLang(lang === "en" ? "ru" : "en"), [lang, setLang]);
  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return React.createElement(Ctx.Provider, { value: { lang, theme, toggleLang, toggleTheme } }, children);
}

export function useSettings() {
  return useContext(Ctx);
}
