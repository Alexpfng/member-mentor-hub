import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { createDemoSession } from "@/lib/demo.functions";

export const Route = createFileRoute("/demo")({
  ssr: false,
  component: DemoEntry,
});

function DemoEntry() {
  const router = useRouter();
  const [message, setMessage] = useState("Préparation de ton espace d’essai…");

  useEffect(() => {
    window.sessionStorage.setItem("cst-demo-mode", "1");
    let cancelled = false;

    async function enterDemo() {
      try {
        const { data: current } = await supabase.auth.getSession();
        if (current.session?.user.app_metadata?.demo_mode === true) {
          await router.navigate({ to: "/membre" });
          return;
        }

        setMessage("Ouverture du compte de démonstration…");
        const { tokenHash } = await createDemoSession();
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });
        if (error || data.user?.app_metadata?.demo_mode !== true) {
          throw new Error(error?.message ?? "La session démo n’a pas pu être vérifiée.");
        }
        if (!cancelled) await router.navigate({ to: "/membre" });
      } catch (error) {
        console.error("[demo] unable to start demo session", error);
        if (!cancelled) {
          setMessage("Le compte démo n’est pas encore prêt. Réessaie dans un instant.");
        }
      }
    }

    void enterDemo();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#101510", color: "#f4efdf", fontFamily: "Manrope, system-ui, sans-serif" }}>
      <section style={{ width: "min(100%, 420px)", padding: 32, border: "1px solid #ffffff20", borderRadius: 8, background: "#171e18", textAlign: "center" }}>
        <div style={{ color: "#a9d27b", font: "10px 'DM Mono', monospace", letterSpacing: ".16em", textTransform: "uppercase" }}>COLOSMARTRAINING · MODE DÉMO</div>
        <h1 style={{ margin: "18px 0 12px", font: "700 36px 'Big Shoulders Display', 'Arial Narrow', sans-serif", textTransform: "uppercase" }}>On prépare ton espace.</h1>
        <p role="status" style={{ margin: 0, color: "#b8b1a0", fontSize: 13, lineHeight: 1.7 }}>{message}</p>
        <a href="https://www.colosmartraining.fr/demo.html" style={{ display: "inline-block", marginTop: 24, color: "#a9d27b", fontSize: 12 }}>Retour à l’essai interactif ↗</a>
      </section>
    </main>
  );
}
