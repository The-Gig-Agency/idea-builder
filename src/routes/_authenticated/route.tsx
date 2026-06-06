import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out.");
    navigate({ to: "/" });
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b hairline">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-mono text-xs tracking-[0.22em] uppercase">MusicDNA</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/onboarding" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Onboarding</Link>
            <Link to="/play" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Play</Link>
            <Link to="/profile" className="text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>Profile</Link>
            <button onClick={signOut} className="text-muted-foreground hover:text-foreground">Sign out</button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
