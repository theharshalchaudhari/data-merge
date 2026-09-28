"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Moon,
  Sun,
} from "lucide-react";

export default function ThemeToggle() {
  const [
    dark,
    setDark,
  ] = useState(false);

  useEffect(() => {
    const stored =
      localStorage.getItem(
        "theme",
      );

    const prefersDark =
      window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;

    const isDark =
      stored === "dark" ||
      (!stored &&
        prefersDark);

    document.documentElement.classList.toggle(
      "dark",
      isDark,
    );

    setDark(isDark);
  }, []);

  function toggleTheme() {
    const next =
      !dark;

    document.documentElement.classList.toggle(
      "dark",
      next,
    );

    localStorage.setItem(
      "theme",
      next
        ? "dark"
        : "light",
    );

    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm transition hover:bg-accent"
      aria-label={
        dark
          ? "Switch to light theme"
          : "Switch to dark theme"
      }
    >
      <span className="flex items-center gap-2.5">
        {dark ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}

      </span>

      <span className="text-xs text-muted-foreground">
        {dark
          ? "Dark"
          : "Light"}
      </span>
    </button>
  );
}