# Campus Helper

CampusHelper is a full-stack campus lost-and-found platform for authenticated reports, image uploads, searchable records, claims, and moderation workflows.

- Status: Live platform
- Portfolio case study: https://subhajitpradhan.vercel.app/projects/campushelper
- Inspect the implementation: `src/app`, `src/lib`, `prisma`, and the API routes

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com/)

---

## ✨ Features

### Core Functionality
- 📝 **Post Items** - Report lost or found items with detailed descriptions and images
- 🔎 **Advanced Search** - Find items by type, location, date, and keywords
- 🖼️ **Image Support** - Upload and display item photos for better identification
- 🏷️ **Claim System** - Connect item owners with finders through secure claims
- 💬 **Comments** - Facilitate communication between users about items
- 📊 **Admin Dashboard** - Comprehensive moderation and management tools

### Reuniting items faster
- 🔗 **Smart match engine** - Automatically pairs LOST and FOUND reports using explainable
  signals (title/description similarity, category, campus zone, date proximity, shared tags).
  Every suggestion shows *why* it was paired, not just a score.
- 🗂️ **Categories and tags** - A seeded taxonomy plus free tags, with filter facets on every
  listing surface.
- 🔖 **Saved searches** - Save a filter set and get notified when a matching item is posted.
- 🚫 **Duplicate guard** - Posting a near-identical report returns `409 DUPLICATE_SUSPECTED`
  with the candidates, so accidental double-posts are caught before they happen.

### Closing the loop
- 🔔 **Notification centre** - In-app notifications for claims, matches, saved-search hits,
  handover lifecycle, item resolution, and moderation outcomes, with an unread badge in the
  navbar. (Comment notifications are not wired up — see ROADMAP-V2 for known gaps.)
- 🔑 **Handover verification** - Approving a claim issues a six-digit code. The item is only
  marked returned once the code is verified in person, so "approved" cannot be mistaken for
  "returned". Codes expire in 72 hours and are burned after five wrong attempts.
- 🗺️ **Campus zones and map** - Reports carry a structured campus zone, with a schematic
  inline-SVG map showing report density per zone. No external map provider or API key.

### Trust and operations
- 🏅 **Reputation and badges** - An append-only points ledger drives tier badges: posting is worth
  2, an approved claim 5, and a verified return 25 to both parties. Student verification is granted
  by a moderator and labelled as such.
- 📜 **Audit log and bulk moderation** - Every privileged action is recorded with actor,
  reason, and IP. Items and users can be moderated in bulk (up to 50 at a time), each change
  individually audited.
- 📈 **Impact analytics and CSV export** - Resolution rate, median time-to-return, daily volume,
  top zones and categories, and the claims funnel — plus CSV exports guarded against
  spreadsheet formula injection and audited as data egress.

### Security & Quality
- 🔐 **Google OAuth** - Secure authentication via NextAuth.js
- 🛡️ **CSRF Protection** - Cross-site request forgery prevention
- ⚡ **Rate Limiting** - API abuse prevention, returning `429` with `Retry-After`
- ✅ **Input Validation** - Server-side validation with Zod
- 🔒 **Row Level Security** - Database-level access control (RLS)
- 🎨 **Responsive Design** - Mobile-first, accessible UI with Tailwind CSS

---

## 🛠️ Tech Stack

### Frontend
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[React 18](https://reactjs.org/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first styling
- **[shadcn/ui](https://ui.shadcn.com/)** - High-quality components
- **[Framer Motion](https://www.framer.com/motion/)** - Animations

### Backend
- **[Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)** - Serverless API
- **[Supabase](https://supabase.com/)** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - File storage
  - Real-time subscriptions
- **[Prisma](https://www.prisma.io/)** - Database ORM
- **[NextAuth.js](https://next-auth.js.org/)** - Authentication

### Utilities
- **[Zod](https://zod.dev/)** - Runtime type validation
- **[React Hook Form](https://react-hook-form.com/)** - Form management
- **[Lucide React](https://lucide.dev/)** - Icon library
- **[Rate Limiter Flexible](https://github.com/animir/node-rate-limiter-flexible)** - API rate limiting

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- A Supabase account
- A Google Cloud Console project (for OAuth)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/subhajitlucky/campushelper.git
   cd campushelper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create `.env.local` file:
   ```env
   # NextAuth Configuration
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here

   # Database
   DATABASE_URL=your-supabase-database-url

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # Google OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret

   # Optional: Custom base URL for API calls
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

4. **Set up Supabase**

   a. Create a new project at [supabase.com](https://supabase.com)

   b. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```

   c. Create storage buckets in Supabase Dashboard → Storage:
   - `item-images` (public, 5MB limit, image/jpeg/png/webp)
   - `user-avatars` (public, 2MB limit, image/jpeg/png/webp)

5. **Set up Google OAuth**

   a. Go to [Google Cloud Console](https://console.cloud.google.com/)

   b. Create a new project or select existing

   c. Enable Google+ API

   d. Create OAuth 2.0 credentials

   e. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://campushelper.vercel.app/api/auth/callback/google` (production)

6. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

7. **Run the development server**
   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000) in your browser

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth endpoints
│   │   ├── items/         # Item CRUD operations
│   │   ├── claims/        # Claim system
│   │   ├── comments/      # Comment system
│   │   ├── upload/        # File upload handler
│   │   └── csrf-token/    # CSRF protection
│   ├── dashboard/         # User dashboard
│   ├── post/              # Post item page
│   └── ...
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui components
│   ├── forms/            # Form components
│   ├── PostItemForm.tsx  # Item posting form
│   ├── ImageUpload.tsx   # Image upload component
│   └── ...
├── lib/                  # Utility functions
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   ├── supabase.ts       # Supabase client
│   ├── security.ts       # Security utilities
│   ├── csrf.ts           # CSRF protection
│   └── schemas/          # Zod validation schemas
├── hooks/                # Custom React hooks
│   ├── useAuthFetch.ts   # Authenticated fetch
│   └── useFormValidation.ts # Form validation
└── types/                # TypeScript type definitions
```

---

## 🔌 API Endpoints

### Items
- `GET /api/items` - List items with pagination and filters (`status`, `itemType`, `location`,
  `search`, `from`, `to`, `category`, `zone`, `tags`)
- `POST /api/items` - Create a new item. Returns `409 DUPLICATE_SUSPECTED` with candidate
  previews if the report looks like a duplicate; resend with `acknowledgeDuplicates: true`
  to post anyway.
- `GET /api/items/[id]` - Get item details
- `PUT /api/items/[id]` - Update item (owner only)
- `DELETE /api/items/[id]` - Delete item (owner/admin)
- `GET /api/items/[id]/matches` - Possible LOST/FOUND counterparts (poster or moderator only)

### Taxonomy
- `GET /api/categories` - Categories with live item counts
- `GET /api/zones` - Campus zones with item, lost, and found counts

### Matches
- `POST /api/matches/[id]` - Dismiss or confirm a suggestion (either item's owner)

### Saved searches
- `GET /api/saved-searches` - The signed-in user's saved searches
- `POST /api/saved-searches` - Save a search (max 20 per user)
- `DELETE /api/saved-searches/[id]` - Delete one (owner only)

### Notifications
- `GET /api/notifications` - Paginated inbox, `?unread=true` to filter
- `GET /api/notifications/unread-count` - Unread badge count
- `POST /api/notifications/read` - `{ all: true }` or `{ ids: [...] }`

### Claims
- `GET /api/claims` - List claims
- `POST /api/claims` - Create a claim on an item
- `PUT /api/claims/[id]` - Approve or reject a claim (item poster or admin); approval issues a
  handover code
- `GET /api/claims/[id]/handover` - The handover code and its state (parties to the claim and
  moderators only; never included in the shared item projection)
- `POST /api/claims/[id]/handover` - `{ code }` to verify a handover, or `{ reissue: true }`
  to issue a new code

### Comments
- `GET /api/comments` - List comments
- `POST /api/comments` - Create a comment

### Upload
- `POST /api/upload` - Upload an image (auth required)

### Admin
- `GET /api/admin/audit` - Audit log, filterable by `actorId`, `action`, `targetType`,
  `targetId`, and date range
- `POST /api/admin/items/bulk` - Bulk `FLAG` / `REMOVE` / `RESTORE` (max 50 ids; reason required
  except to restore)
- `POST /api/admin/users/bulk` - Bulk `DEACTIVATE` / `REACTIVATE` / `VERIFY_STUDENT` /
  `UNVERIFY_STUDENT` (max 50 ids; reason required except to reactivate)
- `GET /api/admin/analytics` - Impact metrics, `?range=7d|30d|90d|all`
- `GET /api/admin/export/items` - CSV export (capped at 10,000 rows, audited)
- `GET /api/admin/export/claims` - CSV export (capped at 10,000 rows, audited)

### Authentication
- `GET /api/auth/session` - Get current session
- All NextAuth endpoints under `/api/auth/*`

---

## 🔒 Security Features

### Authentication & Authorization
- ✅ Google OAuth 2.0 integration
- ✅ JWT-based session management
- ✅ Role-based access control (USER, MODERATOR, ADMIN)

### CSRF Protection
- ✅ Synchronizer token pattern
- ✅ CSRF token in HTTP-only cookie
- ✅ Token validation for all state-changing operations

### Rate Limiting
- ✅ Login: 10 attempts per 15 minutes
- ✅ Item creation: 20 per hour
- ✅ Claims: 10 per hour
- ✅ Comments: 30 per hour
- ✅ File uploads: 20 per hour

### Input Validation
- ✅ Server-side validation with Zod
- ✅ SQL injection prevention via Prisma
- ✅ XSS protection via input sanitization
- ✅ File type and size validation

### Database Row Level Security
- ✅ RLS policies protect `User`, `Item`, `Comment`, and `Claim`
- ⚠️ RLS requires the `campushelper_runtime` operator role provisioning (`prisma/operator/`) and is **not enforced when connecting as the table owner**; verification fails by default until that role and its policies are applied

---

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**
   - Import your GitHub repository in Vercel dashboard
   - Set environment variables (see `.env.local` section)

3. **Update Environment Variables**
   ```env
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=your-production-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   DATABASE_URL=your-supabase-database-url
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
   ```

4. **Update Google OAuth**
   - Add production URL to authorized redirect URIs

5. **Deploy**
   - Vercel automatically deploys on push

---

## 📝 Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Database
npx prisma migrate dev     # Create and apply migration
npx prisma generate        # Generate Prisma client
npx prisma studio          # Open Prisma Studio

# Code Quality
npm run lint              # Run ESLint
npm run type-check        # Run TypeScript compiler
```

---

## 🧪 Testing

```bash
npm test                  # unit tests only (no database required)
npm run verify            # prisma validate, migrations, typecheck, lint, tests
```

The suite has two layers:

- **Unit tests** (`tests/unit`, `src/lib/__tests__`) cover the pure logic — match scoring,
  reputation rules and tiers, CSV serialisation and formula-injection guards, analytics
  derivations including the median, notification formatting, and every Zod schema. No database
  is needed, so these run in CI.
- **Integration tests** (`tests/integration`) exercise the admin routes against a **real
  PostgreSQL database**, stubbing only the session and CSRF checks so the Prisma aggregates,
  CSV serialisation, audit writes, and bulk updates are real code paths. These **skip
  automatically when `DATABASE_URL` is unset**, because CI has no database. To run them, point
  `DATABASE_URL` at a disposable database that has had `npx prisma migrate deploy` applied.

**Known limitation:** CI has no database, so the non-admin API routes (items, claims,
notifications, and the rest) are covered by typecheck and lint rather than by integration
tests. The performance-sensitive admin paths are the ones with database-backed coverage.

### Manual Testing Checklist

1. **Authentication**
   - [ ] Sign up with Google OAuth
   - [ ] Sign out and sign back in
   - [ ] Protected routes redirect to login

2. **Item Posting**
   - [ ] Create item with all fields
   - [ ] Upload image (optional)
   - [ ] Submit and verify in dashboard

3. **Search & Browse**
   - [ ] Filter by LOST/FOUND
   - [ ] Search by keyword
   - [ ] Filter by location

4. **Claims**
   - [ ] Create claim on item
   - [ ] View incoming claims (as owner)
   - [ ] Mark claim as resolved

5. **Admin Features**
   - [ ] Access admin dashboard
   - [ ] Moderate items
   - [ ] Manage users

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow TypeScript best practices
   - Add comments for complex logic
   - Ensure type safety

4. **Test thoroughly**
   ```bash
   npm run build
   npm run lint
   npm run type-check
   ```

5. **Commit your changes**
   ```bash
   git commit -m "feat: add new feature description"
   ```

6. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

If you encounter any issues or have questions:

1. Check existing [GitHub Issues](../../issues)
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) team for the excellent framework
- [Supabase](https://supabase.com/) for backend infrastructure
- [shadcn](https://twitter.com/shadcn) for the component library
- The open-source community for invaluable resources

---

## 📊 Project Status

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue?style=flat-square)]()
[![Code Style](https://img.shields.io/badge/code%20style-prettier-ff69b4?style=flat-square)]()

---

**Made with ❤️ for university communities**
