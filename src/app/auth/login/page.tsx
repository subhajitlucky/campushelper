import Link from "next/link";

import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Need an account?{" "}
          <Link href="/auth/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <LoginForm />
      </div>
    </div>
  );
}
