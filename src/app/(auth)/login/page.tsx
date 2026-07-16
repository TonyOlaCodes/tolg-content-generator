import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/40">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">TOLG</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Sign in to Content Generator
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
