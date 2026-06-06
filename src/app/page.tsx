"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/dashboard");
      else setChecking(false);
    });
    return unsub;
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <Loader fullScreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white ">
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-navy/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-navy/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <img src="/nexayra.png" alt="Nexayra Arc" className="h-20 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div>
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 shadow-xl shadow-navy/5 border border-navy-100">
          <h2 className="font-lato text-navy dark:text-white text-xl font-bold mb-1">Sign In</h2>
          <p className="text-navy dark:text-white text-sm mb-6">Access the document portal</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm animate-scale-in">{error}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-navy dark:text-white-600 text-xs font-bold uppercase tracking-wider mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 bg-navy-50/50 border border-navy-200 rounded-xl text-navy dark:text-white placeholder-navy-300 text-sm" placeholder="you@nexayraarc.com" />
            </div>
            <div>
              <label className="block text-navy dark:text-white-600 text-xs font-bold uppercase tracking-wider mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-3 bg-navy-50/50 border border-navy-200 rounded-xl text-navy dark:text-white placeholder-navy-300 text-sm" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="mt-6 w-full py-3.5 bg-navy hover:bg-navy-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm uppercase tracking-wider">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
