import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";

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

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeo("Sign in — Freeform Email", "Sign in or create an account to access Freeform Email.");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate('/mail');
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/mail');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Signed in', description: 'Welcome back!' });
        navigate('/mail');
      } else {
        const redirectUrl = `${window.location.origin}/mail`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl }
        });
        if (error) throw error;
        if (data.session) {
          toast({ title: 'Account created', description: 'You are now signed in.' });
          navigate('/mail');
        } else {
          toast({ title: 'Check your email', description: 'Confirm your address to finish signup.' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Auth error', description: err?.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between py-4">
          <Link to="/"><span className="font-semibold">Freeform Email</span></Link>
          <Button variant="ghost" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create account' : 'Have an account? Sign in'}
          </Button>
        </div>
      </header>

      <main className="container grid place-items-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{mode === 'signin' ? 'Sign in' : 'Create account'}</CardTitle>
            <CardDescription>Use email and password to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? 'Please wait…' : (mode === 'signin' ? 'Sign in' : 'Create account')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
