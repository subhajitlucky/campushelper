'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';

import { setSafeErrorMessage } from '@/lib/security';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
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

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/** Which action is in flight, so each button reports its own progress. */
type PendingAction = 'credentials' | 'google' | null;

export default function LoginForm() {
    const router = useRouter();
    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const [pending, setPending] = useState<PendingAction>(null);
    const [errorMessage, setErrorMessage] = useState('');

    const isLoading = pending !== null;

    // Google Sign-In handler (Step 132: Add Google sign-in button)
    const handleGoogleSignIn = async () => {
        setPending('google');
        setErrorMessage('');

        try {
            const result = await signIn('google', {
                redirect: false,
                callbackUrl: '/dashboard'
            });

            if (result?.error) {
                setErrorMessage(setSafeErrorMessage('Google sign-in failed. Please try again.'));
            } else if (result?.url) {
                // Redirect to dashboard or specified callback URL
                window.location.href = result.url;
            }
        } catch {
            setErrorMessage(setSafeErrorMessage('Something went wrong with Google sign-in.'));
        } finally {
            setPending(null);
        }
    };

    const onSubmit = async (values: LoginFormValues) => {
        setErrorMessage('');
        setPending('credentials');

        try {
            const result = await signIn('credentials', {
                email: values.email,
                password: values.password,
                redirect: false,
            });

            if (result?.error) {
                setErrorMessage(setSafeErrorMessage('Invalid email or password'));
                return;
            }

            router.push('/dashboard');
        } catch {
            setErrorMessage(setSafeErrorMessage('Something went wrong. Please try again.'));
        } finally {
            setPending(null);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
                {/* Errors sit above the form, in one line of destructive text —
                    no box, so the fields stay the loudest thing on the card. */}
                {errorMessage && (
                    <p
                        role="alert"
                        aria-live="polite"
                        className="flex items-start gap-1.5 text-base text-destructive"
                    >
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>{errorMessage}</span>
                    </p>
                )}

                <div className="space-y-5">
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
                                        autoFocus
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
                                        placeholder="Your password"
                                        autoComplete="current-password"
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
                    loading={pending === 'credentials'}
                    disabled={isLoading}
                >
                    Sign in
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
}
