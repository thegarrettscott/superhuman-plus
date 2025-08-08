import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
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
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center gap-3 py-4">
          <Mail className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold tracking-tight">Freeform Email</h1>
          <nav className="ml-auto flex items-center gap-2">
            <Link to="/auth"><Button variant="secondary">Sign in</Button></Link>
          </nav>
        </div>
      </header>

      <main className="container grid place-items-center py-16">
        <section className="max-w-2xl text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Superhuman‑style speed for your Gmail</h2>
          <p className="text-muted-foreground">
            Keyboard-first triage, elegant UI, and seamless Google OAuth. Connect your account and fly through email.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/auth"><Button size="lg">Get started</Button></Link>
            <a href="#features" className="text-sm underline">Learn more</a>
          </div>
        </section>

        <section id="features" className="mt-16 grid w-full gap-6 md:grid-cols-3">
          <article className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Keyboard-first</h3>
            <p className="text-sm text-muted-foreground">J/K to navigate, C to compose, E to archive, and more.</p>
          </article>
          <article className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Google OAuth</h3>
            <p className="text-sm text-muted-foreground">Securely connect your Gmail and import recent messages.</p>
          </article>
          <article className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Beautiful UI</h3>
            <p className="text-sm text-muted-foreground">Clean, responsive design with tasteful motion.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
