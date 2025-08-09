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
      "Freeform Email — Fast Gmail Client",
      "Landing page for Freeform Email: keyboard-first Gmail experience with OAuth integration."
    );
    const ld = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Freeform Email",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "Keyboard-first Gmail client for speed-focused triage",
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
      <header className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center gap-3 py-4">
          <Mail className="h-5 w-5 text-primary" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Freeform Email</span>
          <nav className="ml-auto flex items-center gap-2">
            <Link to="/auth"><Button variant="secondary">Sign in</Button></Link>
          </nav>
        </div>
      </header>

      <main className="container grid place-items-center py-16">
        <section className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Superhuman‑style speed for your Gmail</h1>
          <p className="text-muted-foreground">
            Keyboard-first triage, elegant UI, and seamless Google OAuth. Connect your account and fly through email.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/auth"><Button size="lg">Get started</Button></Link>
            <a href="#features" className="text-sm underline">Learn more</a>
          </div>
        </section>

        <section id="features" className="mt-16 grid w-full gap-6 md:grid-cols-3">
          <article className="rounded-lg border bg-card p-6 shadow-sm transition-transform duration-200 hover:scale-105">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <h3 className="font-semibold mb-1">Keyboard-first</h3>
            <p className="text-sm text-muted-foreground">J/K to navigate, C to compose, E to archive, and more.</p>
          </article>
          <article className="rounded-lg border bg-card p-6 shadow-sm transition-transform duration-200 hover:scale-105">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <h3 className="font-semibold mb-1">Google OAuth</h3>
            <p className="text-sm text-muted-foreground">Securely connect your Gmail and import recent messages.</p>
          </article>
          <article className="rounded-lg border bg-card p-6 shadow-sm transition-transform duration-200 hover:scale-105">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <h3 className="font-semibold mb-1">Beautiful UI</h3>
            <p className="text-sm text-muted-foreground">Clean, responsive design with tasteful motion.</p>
          </article>
        </section>

        <section aria-labelledby="testimonials" className="mt-10 w-full">
          <h2 id="testimonials" className="sr-only">What users say</h2>
          <div className="rounded-lg border bg-card p-6 md:p-8">
            <p className="text-sm md:text-base text-muted-foreground">
              “Freeform Email lets me clear my inbox twice as fast. The keyboard shortcuts are spot on.”
            </p>
            <p className="mt-3 text-xs md:text-sm">— Beta user</p>
          </div>
        </section>
      </main>
      <footer className="border-t bg-background/70">
        <div className="container py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Freeform Email · <Link to="/search" className="underline">Search</Link>
        </div>
      </footer>
    </div>
  );
}
