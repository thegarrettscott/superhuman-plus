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
  const [mode, setMode] = useState<'signin'|'signup'|'forgot'|'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeo("Sign in — Freeform Email", "Sign in or create an account to access Freeform Email.");

    // Check if user is coming from password reset email
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery') {
      setMode('reset');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event !== 'PASSWORD_RECOVERY') {
        navigate('/mail');
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mode !== 'reset') navigate('/mail');
    });
    return () => subscription.unsubscribe();
  }, [navigate, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Signed in', description: 'Welcome back!' });
        navigate('/mail');
      } else if (mode === 'signup') {
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
      } else if (mode === 'forgot') {
        const redirectUrl = `${window.location.origin}/auth`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl
        });
        if (error) throw error;
        toast({ 
          title: 'Reset email sent', 
          description: 'Check your email for a password reset link.' 
        });
        setMode('signin');
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const { error } = await supabase.auth.updateUser({
          password: password
        });
        if (error) throw error;
        toast({ 
          title: 'Password updated', 
          description: 'Your password has been successfully updated.' 
        });
        navigate('/mail');
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
            <CardTitle>
              {mode === 'signin' && 'Sign in'}
              {mode === 'signup' && 'Create account'}
              {mode === 'forgot' && 'Reset password'}
              {mode === 'reset' && 'Set new password'}
            </CardTitle>
            <CardDescription>
              {mode === 'forgot' && 'Enter your email to receive a reset link.'}
              {mode === 'reset' && 'Enter your new password below.'}
              {(mode === 'signin' || mode === 'signup') && 'Use email and password to continue.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <Label htmlFor="password">{mode === 'reset' ? 'New Password' : 'Password'}</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              )}
              {mode === 'reset' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              )}
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? 'Please wait…' : (
                  mode === 'signin' ? 'Sign in' : 
                  mode === 'signup' ? 'Create account' : 
                  mode === 'forgot' ? 'Send reset email' :
                  'Update password'
                )}
              </Button>
              {mode === 'signin' && (
                <div className="text-center">
                  <Button variant="link" type="button" onClick={() => setMode('forgot')} className="text-sm">
                    Forgot password?
                  </Button>
                </div>
              )}
              {mode === 'forgot' && (
                <div className="text-center">
                  <Button variant="link" type="button" onClick={() => setMode('signin')} className="text-sm">
                    Back to sign in
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
