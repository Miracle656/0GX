"use client";

import { Toaster } from "@/components/ui/sonner";

interface AppShellProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export function AppShell({ eyebrow, title, description, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 pb-12 pt-36 sm:px-8 lg:px-10">
        {(title || eyebrow || description) && (
          <section className="rounded-4xl py-5 lg:py-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                {title && (
                  <h1 className="mt-3 text-3xl font-semibold tracking-title text-foreground sm:text-4xl">
                    {title}
                  </h1>
                )}
              </div>
              {description && (
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </section>
        )}
        {children}
      </div>
      <Toaster />
    </main>
  );
}
