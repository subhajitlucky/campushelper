"use client";

import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { setSafeErrorMessage } from '@/lib/security';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

/**
 * The real Google mark, in its brand colours.
 *
 * The one deliberate exception to the token rule: this is a third-party logo,
 * and recolouring it would misrepresent the provider. It is a fixed asset
 * rather than a theme colour, so it is identical in light and dark.
 */
const GoogleMark = () => (
  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const signupSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name must be at most 100 characters long'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

/** Which action is in flight, so each button reports its own progress. */
type PendingAction = 'signup' | 'google' | null;

const SignupForm = () => {
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const router = useRouter();

  const [pending, setPending] = useState<PendingAction>(null);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const isLoading = pending !== null;

  const handleGoogleSignIn = async () => {
    setPending('google');
    setServerError('');
    setSuccess(false);

    try {
      const result = await signIn('google', {
        redirect: false,
        callbackUrl: '/dashboard',
      });

      if (result?.error) {
        setServerError(setSafeErrorMessage('Google sign-in failed. Please try again.'));
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setServerError(setSafeErrorMessage('Something went wrong with Google sign-in.'));
    } finally {
      setPending(null);
    }
  };

  const onSubmit = async (values: SignupFormValues) => {
    setServerError('');
    setSuccess(false);
    setPending('signup');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
        }),
      });

      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setServerError(data.error ?? 'Signup failed. Please try again.');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 1500);
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setPending(null);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Errors and confirmations sit above the form, as plain text. */}
        {serverError && (
          <p
            role="alert"
            aria-live="polite"
            className="flex items-start gap-1.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{serverError}</span>
          </p>
        )}

        {success && (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-sm text-success"
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            Account created. Taking you to sign in…
          </p>
        )}

        <div className="space-y-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Your name"
                    autoComplete="name"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="you@campus.edu"
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>At least 8 characters.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    placeholder="Type it once more"
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* One primary action. */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={pending === 'signup'}
          disabled={isLoading}
        >
          Create account
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>

        {/* Secondary, outlined, with the real Google mark. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full gap-2"
          onClick={handleGoogleSignIn}
          loading={pending === 'google'}
          disabled={isLoading}
        >
          <GoogleMark />
          Continue with Google
        </Button>
      </form>
    </Form>
  );
};

export default SignupForm;
