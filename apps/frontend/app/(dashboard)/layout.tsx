"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../hooks/use-auth";

const links = [
  {
    href: "/dashboard",
    label: "Dashboard",
  },
  {
    href: "/clients",
    label: "Clients",
  },
  {
    href: "/views",
    label: "Views",
  },
  {
    href: "/metadata",
    label: "Metadata",
  },
  {
    href: "/upload",
    label: "Upload",
  },
  {
    href: "/users",
    label: "Users",
  },
  {
    href: "/download",
    label: "Download",
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(
        `/login?next=${encodeURIComponent(pathname)}`,
      );
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card md:block">
        <div className="p-6">
          <h1 className="font-semibold">
            Data Manage
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Dataset management
          </p>
        </div>

        <nav className="space-y-1 px-3">
          {links
            .filter(
              (link) =>
                link.label !== "Users" ||
                user.role === "admin",
            )
            .map((link) => {
              const active =
                pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t p-4">
          <p className="truncate text-sm font-medium">
            {user.name}
          </p>

          <p className="text-xs text-muted-foreground">
            {user.role}
          </p>

          <button
            type="button"
            onClick={async () => {
              try {
                await logout();
              } finally {
                router.replace("/login");
              }
            }}
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        {children}
      </div>
    </div>
  );
}