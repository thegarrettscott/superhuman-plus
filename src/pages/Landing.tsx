import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Zap, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const setSeo = (title: string, description: string) => {
  document.title = title;
  const metaDesc = document.querySelector('meta[name="description"]') || (() => {
    const m = document.createElement('meta');
    m.setAttribute('name', 'description');
    document.head.appendChild(m);
    return m;
  })();
  metaDesc.setAttribute('content', description);
  const existingCanonical = document.querySelector('link[rel="canonical"]');
  const canonical = existingCanonical || (() => {
    const l = document.createElement('link');
    l.setAttribute('rel', 'canonical');
    document.head.appendChild(l);
    return l;
  })();
  canonical.setAttribute('href', window.location.href);
};

export default function Landing() {
  useEffect(() => {
    setSeo(
      "Velocity Mail — Superhuman-style Gmail Client", 
      "Connect Gmail and fly through email with speed, keyboard-first controls, and a refined interface."
    );
    const ld = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication", 
      name: "Velocity Mail",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "Superhuman-style Gmail client with blazing-fast shortcuts and focused triage workflow",
      url: window.location.origin,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
    };
    let script = document.getElementById("ld-software-app") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "ld-software-app"; 
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center gap-3 py-4">
          <Mail className="h-6 w-6 text-primary" aria-hidden />
          <span className="text-xl font-bold tracking-tight">Velocity Mail</span>
          <nav className="ml-auto flex items-center gap-2">
            <Link to="/auth">
              <Button variant="outline" size="sm">Sign in</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container">
        <section className="py-20 text-center space-y-8">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            Superhuman‑style speed<br />for your Gmail
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Keyboard-first triage, elegant interface, and seamless Google OAuth. Connect your account and fly through email with blazing speed.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link to="/auth">
              <Button size="lg" className="px-8 py-3 text-lg font-semibold">
                Get started
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="px-8 py-3 text-lg" asChild>
              <a href="#features">Learn more</a>
            </Button>
          </div>
        </section>

        <section id="features" className="py-16 grid gap-8 md:grid-cols-3">
          <article className="group rounded-2xl border bg-card/50 p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:bg-card">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Zap className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <h3 className="text-xl font-semibold mb-3">Keyboard-first</h3>
            <p className="text-muted-foreground">Navigate with J/K, compose with C, archive with E. Every action has a shortcut.</p>
          </article>
          
          <article className="group rounded-2xl border bg-card/50 p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:bg-card">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <h3 className="text-xl font-semibold mb-3">Google OAuth</h3>
            <p className="text-muted-foreground">Securely connect your Gmail account and import your recent messages instantly.</p>
          </article>
          
          <article className="group rounded-2xl border bg-card/50 p-8 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:bg-card">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <h3 className="text-xl font-semibold mb-3">Beautiful UI</h3>
            <p className="text-muted-foreground">Clean, responsive design with smooth animations and thoughtful interactions.</p>
          </article>
        </section>

        <section className="py-16">
          <div className="rounded-3xl border bg-gradient-to-br from-card/80 to-card p-8 md:p-12 text-center shadow-lg">
            <blockquote className="text-lg md:text-xl text-muted-foreground italic">
              "Velocity Mail lets me clear my inbox twice as fast. The keyboard shortcuts are perfect."
            </blockquote>
            <p className="mt-4 text-sm font-medium">— Early adopter</p>
          </div>
        </section>
      </main>
      
      <footer className="border-t bg-background/95">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Velocity Mail · Built for speed</p>
        </div>
      </footer>
    </div>
  );
}
