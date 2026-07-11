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

### Security & Quality
- 🔐 **Google OAuth** - Secure authentication via NextAuth.js
- 🛡️ **CSRF Protection** - Cross-site request forgery prevention
- ⚡ **Rate Limiting** - API abuse prevention
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
- **[Rate Limiter Flexible](https://github.com/vvo/rrul)** - API rate limiting

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
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)

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
- `GET /api/items` - List items with pagination and filters
- `POST /api/items` - Create a new item
- `GET /api/items/[id]` - Get item details
- `PUT /api/items/[id]` - Update item (owner only)
- `DELETE /api/items/[id]` - Delete item (owner/admin)

### Claims
- `GET /api/claims` - List claims
- `POST /api/claims` - Create a claim on an item

### Comments
- `GET /api/comments` - List comments
- `POST /api/comments` - Create a comment

### Upload
- `POST /api/upload` - Upload an image (auth required)

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
