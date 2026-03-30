import { AppShell } from "@/components/AppShell";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      <AppShell>{children}</AppShell>
    </div>
  );
}
