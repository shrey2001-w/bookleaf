import AppShell from "@/components/AppShell";
export default function AuthorLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="author">{children}</AppShell>;
}
