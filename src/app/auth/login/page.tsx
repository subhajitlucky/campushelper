import Link from "next/link";

import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Product identity above the card: what this is, before asking for
            anything. The wordmark is also the way back to the homepage. */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
          >
            Campus Helper
          </Link>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            The campus lost-and-found. Report what went missing, and get it back.
          </p>
        </div>

        <div className="card-surface p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            Use the account you signed up with.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-6 text-base text-muted-foreground">
          New here?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
