"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  Moon,
  Sun,
} from "lucide-react";

type Theme = "light" | "dark";

function getTheme(): Theme {
  const stored =
    localStorage.getItem("theme");

  if (
    stored === "light" ||
    stored === "dark"
  ) {
    return stored;
  }

  return window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] =
    useState<Theme | null>(null);

  useEffect(() => {
    const current = getTheme();

    setTheme(current);

    function handleSystemThemeChange() {
      if (
        localStorage.getItem("theme")
      ) {
        return;
      }

      const next =
        window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches
          ? "dark"
          : "light";

      document.documentElement.classList.toggle(
        "dark",
        next === "dark",
      );

      setTheme(next);
    }

    const mediaQuery =
      window.matchMedia(
        "(prefers-color-scheme: dark)",
      );

    mediaQuery.addEventListener(
      "change",
      handleSystemThemeChange,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleSystemThemeChange,
      );
    };
  }, []);

  function toggleTheme() {
    const current =
      theme ?? getTheme();

    const next: Theme =
      current === "dark"
        ? "light"
        : "dark";

    document.documentElement.classList.toggle(
      "dark",
      next === "dark",
    );

    localStorage.setItem(
      "theme",
      next,
    );

    setTheme(next);
  }

  if (!theme) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm opacity-50"
        aria-hidden="true"
      >
        <span className="size-4" />
        <span className="text-xs text-muted-foreground">
          Theme
        </span>
      </button>
    );
  }

  const dark = theme === "dark";

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