# Hyper-Detailed NextAuth Authentication Roadmap for Campus Helper

Alright, yaar! Straight talk: You're right, the schema is solid, and auth is the logical next step. We'll implement NextAuth from scratch, step-by-step, so you learn every bit—credentials login/signup, Google OAuth, session management, route protection, and UI integration. Each step is tiny (even "import Zod" is a step) to build confidence. No rushing; we'll test after each major chunk.

This roadmap assumes your current setup: NextAuth partially configured with credentials, Prisma schema ready, Supabase connected. We'll expand it fully. Total ~80 steps, broken into phases. Start with Phase 1.

## Phase 1: Credentials Auth Setup (Email/Password Login & Signup)
*(Build basic auth with manual registration/login. Learn providers, authorize function, hashing.)*

✅ 1. Open `src/lib/auth.ts` in editor.

✅ 2. Review current NextAuth config (credentials provider, bcrypt import).

✅ 3. Create `src/app/api/auth/signup/route.ts` file.

✅ 4. Import NextRequest, NextResponse from 'next/server'.

✅ 5. Import prisma from '@/lib/prisma'.

✅ 6. Import bcrypt from 'bcryptjs'.

✅ 7. Import z from 'zod'.

✅ 8. Define Zod schema for signup: email (string, email), password (string, min 8), name (string, min 1).

✅ 9. Export async POST function in route.ts.

✅ 10. Parse JSON body from request.

✅ 11. Validate body with Zod schema.

✅ 12. Check if user with email already exists in prisma.user.findUnique.

✅ 13. If exists, return 400 error: "User already exists".

✅ 14. Hash password with bcrypt.hash (salt rounds 12).

✅ 15. Create user with prisma.user.create (email, name, hashed password).

✅ 16. Return 201 success with user data (id, email, name).

✅ 17. Add try/catch for errors, return 500 on failure.

✅ 18. Test signup API manually (use Postman or curl: POST /api/auth/signup with JSON body).

✅ 19. Create `src/components/SignupForm.tsx` component.

✅ 20. Import useState from 'react'.

✅ 21. Import Button, Input, Label from '@/components/ui'.

✅ 22. Import useForm, Controller from 'react-hook-form'.

✅ 23. Import zodResolver from '@hookform/resolvers/zod'.

✅ 24. Define form schema (same as API: email, password, name).

✅ 25. Create form with useForm hook, resolver: zodResolver(schema).

26. Add email input field with Controller.

27. Add password input field with Controller.

28. Add name input field with Controller.

29. Add submit button.

30. Define onSubmit handler: fetch POST /api/auth/signup, handle response.

31. Show success/error messages with state.

32. Export SignupForm.

33. Create `src/app/auth/signup/page.tsx` page.

34. Import SignupForm.

35. Render SignupForm in a centered layout.

36. Add link to login page.

37. Test signup form in browser (/auth/signup).

38. Create `src/components/LoginForm.tsx` component.

39. Similar to SignupForm: useForm, zodResolver, fields for email/password.

40. onSubmit: fetch POST /api/auth/signin/credentials (NextAuth signin).

41. Handle signin response, redirect on success.

42. Create `src/app/auth/login/page.tsx` page.

43. Import LoginForm.

44. Render LoginForm.

45. Add link to signup page.

46. Test login form (/auth/login).

47. Update Navbar to show login/signup links if not authenticated.

48. Import useSession from 'next-auth/react'.

49. Wrap app in SessionProvider (in layout.tsx).

50. Add conditional rendering in Navbar: show login/signup or logout if session.

## Phase 2: Google OAuth Integration
*(Add Google provider, learn OAuth flow, handle social login.)*

51. Go to Google Cloud Console, create project.

52. Enable Google+ API.

53. Create OAuth 2.0 credentials (client ID, secret).

54. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.

55. In `src/lib/auth.ts`, import GoogleProvider from 'next-auth/providers/google'.

56. Add GoogleProvider to providers array.

57. Configure clientId, clientSecret from env.

58. Add profile callback to map Google profile to user (id, email, name, image).

59. Update User model in authorize (credentials) to handle googleId.

60. Create `src/app/api/auth/[...nextauth]/route.ts` (already exists, review).

✅ 61. Ensure GET/POST handlers are exported.

62. Add NEXTAUTH_SECRET to .env (generate random string).

63. Add NEXTAUTH_URL to .env (http://localhost:3000 for dev).

64. Test Google login: Add "Sign in with Google" button in LoginForm.

65. Use signIn('google') on click.

66. Handle callback: Update user on first Google login (upsert with googleId).

67. Add googleId to Prisma user creation in signup if needed.

68. Test full Google flow: Login, check session, logout.

69. Update SignupForm to allow optional Google signup.

70. Add profile picture handling from Google (avatar field).

## Phase 3: Session Management & Route Protection
*(Learn sessions, middleware, protecting pages.)*

71. Create `middleware.ts` in root.

72. Import withAuth from 'next-auth/middleware'.

73. Export default withAuth for protected routes (e.g., /dashboard).

74. Add auth config: pages: { signIn: '/login' }.

75. Create `src/app/dashboard/page.tsx` protected page.

76. Import useSession.

77. Show user info if authenticated, else redirect.

78. Test middleware: Try accessing /dashboard without login.

79. Update layout.tsx to conditionally show content based on session.

80. Add logout functionality: signOut() in Navbar.

81. Handle session errors (e.g., expired token).

82. Add email verification (optional: send email on signup).

83. Test end-to-end: Signup → Login → Dashboard → Logout.

This roadmap is exhaustive—each step builds on the last. Ready to start? Let's begin with Step 1: Open `src/lib/auth.ts`. Tell me when you're done, and we'll move to Step 2. Or if you want me to implement a step, say so! 🚀