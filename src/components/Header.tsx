"use client";
import Link from "next/link";
import { useSettings } from "@/lib/useSettings";

export default function Header() {
  const { lang, theme, toggleLang, toggleTheme } = useSettings();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="logo">BotMake Direct</Link>
        <div className="header-controls">
          <button className="header-btn" onClick={toggleLang} title={lang === "en" ? "Switch to Russian" : "Переключить на English"}>
            {lang === "en" ? "RU" : "EN"}
          </button>
          <button className="header-btn" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {theme === "dark" ? (
                <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>
              ) : (
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              )}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
