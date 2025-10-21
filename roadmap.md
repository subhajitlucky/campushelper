# Campus Helper Roadmap

A comprehensive roadmap for building the Campus Helper project, a centralized platform for managing lost and found items on campus, featuring user authentication, item posting, search, and claims.

## Phase 1 — Setup & UI
- 🟦 **Step 1:** Create Next.js 15 project *(complete; project scaffolded)*
- 🟦 **Step 2:** Set up Tailwind CSS and shadcn/ui component library *(complete; installed and tested)*
- 🟦 **Step 3:** Build homepage layout (header, footer, primary sections) *(complete; hero + highlights drafted)*
- ☐ **Step 4:** Implement "Post Lost/Found" form UI (frontend-only)

## Phase 2 — Backend & Database
- ☐ **Step 5:** Configure Prisma and connect to Supabase PostgreSQL
- ☐ **Step 6:** Define Prisma schema for `User`, `Item`, and supporting models
- ☐ **Step 7:** Build API routes for item CRUD operations
- ☐ **Step 8:** Display items on homepage via server/client data fetching

## Phase 3 — Authentication & Image Upload
- ☐ **Step 9:** Integrate NextAuth.js with Google authentication
- ☐ **Step 10:** Configure Cloudinary for image uploads and retrieval
- ☐ **Step 11:** Restrict item posting to authenticated users

## Phase 4 — Advanced Features
- ☐ **Step 12:** Implement claim workflow between owners and finders
- ☐ **Step 13:** Add item search and filtering (category, location, date)
- ☐ **Step 14:** Enable admin moderation (resolve, remove duplicates)

## Phase 5 — Final Touches & Deployment
- ☐ **Step 15:** Polish UX with loading states, animations, responsiveness
- ☐ **Step 16:** Test database, API routes, auth, and image flows end-to-end
- ☐ **Step 17:** Deploy to Vercel with Supabase integration
- ☐ **Step 18:** Finalize documentation with screenshots and usage guide

## Stretch Enhancements
- ☐ Optional activity log to show user-submitted and claimed items
- ☐ Optional email notifications when claims are made or resolved
