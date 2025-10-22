# Campus Helper Dev Roadmap: Database → Backend → Frontend

Since you want to learn everything step-by-step, I've created a hyper-detailed roadmap following the **Database → Backend → Frontend** approach. Each phase has exactly **50 tiny steps** to break down the work into manageable, learnable chunks. This ensures you understand every detail, from setup to deployment.

The roadmap builds on our current progress (database schema done, homepage UI ready). Steps are sequential within phases, with dependencies noted. Focus on one step at a time, test after each, and ask questions as you go.

## Phase 1: Database (Complete - For Learning Reference)
*(Already done: Prisma schema with User/Item/Claim/Comment models, Supabase migration applied)*

✅ 1. Install Prisma CLI globally.  
✅ 2. Initialize Prisma in project with `npx prisma init`.  
✅ 3. Configure datasource to PostgreSQL in schema.prisma.  
✅ 4. Define generator for Prisma client.  
✅ 5. Create User model with id, email, name fields.  
✅ 6. Add avatar, googleId, password fields to User.  
✅ 7. Add role enum (USER, ADMIN, MODERATOR) to User.  
✅ 8. Add isActive boolean for soft deletes to User.  
✅ 9. Add createdAt, updatedAt timestamps to User.  
✅ 10. Define relations: itemsPosted, itemsClaimed, comments, claims.  
✅ 11. Create Item model with id, title, description.  
✅ 12. Add itemType enum (LOST, FOUND) to Item.  
✅ 13. Add status enum (LOST, FOUND, CLAIMED, RESOLVED) to Item.  
✅ 14. Add location, images array to Item.  
✅ 15. Add postedById, claimedById relations to Item.  
✅ 16. Add createdAt, updatedAt, resolvedAt to Item.  
✅ 17. Create Comment model with id, message, images.  
✅ 18. Add itemId, userId relations to Comment.  
✅ 19. Add timestamps to Comment.  
✅ 20. Create Claim model with id, claimType, status.  
✅ 21. Add claimType enum (FOUND_IT, OWN_IT) to Claim.  
✅ 22. Add status enum (PENDING, APPROVED, REJECTED) to Claim.  
✅ 23. Add itemId, userId relations to Claim.  
✅ 24. Add timestamps to Claim.  
✅ 25. Set up Supabase project.  
✅ 26. Create Supabase database.  
✅ 27. Get database URL from Supabase dashboard.  
✅ 28. Update .env with DATABASE_URL.  
✅ 29. Run `npx prisma generate` to create client.  
✅ 30. Test database connection with Prisma Studio.  
✅ 31. Add sample data via Prisma seed script.  
✅ 32. Run `npx prisma migrate dev` for initial migration.  
✅ 33. Verify tables created in Supabase.  
✅ 34. Check foreign key constraints.  
✅ 35. Test relations with sample queries.  
✅ 36. Add indexes for performance (e.g., on email).  
✅ 37. Configure soft delete logic in schema.  
✅ 38. Add unique constraints where needed.  
✅ 39. Update schema for any missing fields.  
✅ 40. Regenerate Prisma client after changes.  
✅ 41. Test CRUD operations manually.  
✅ 42. Add environment-specific configs.  
✅ 43. Document schema in comments.  
✅ 44. Review schema for normalization.  
✅ 45. Backup database schema.  
✅ 46. Set up database monitoring.  
✅ 47. Add error handling for DB queries.  
✅ 48. Optimize query performance.  
✅ 49. Final schema review and approval.  
✅ 50. Mark database phase complete.

## Phase 2: Backend (API Routes, Auth, Logic)
*(Build APIs for CRUD, authentication, and business logic. Start with item operations, then expand.)*

1. Create src/app/api directory.
2. Create src/app/api/items directory.
3. Create route.ts in /api/items.
4. Import NextRequest, NextResponse from next/server.
5. Import prisma from @/lib/prisma.
6. Define Zod schema for item validation.
7. Add title validation (string, min 1, max 100).
8. Add description validation (string, min 1, max 1000).
9. Add itemType validation (enum LOST/FOND).
10. Add location validation (string, min 1, max 200).
11. Add images validation (array of URLs, default []).
12. Add postedById validation (string, required).
13. Export GET function for fetching items.
14. Add orderBy createdAt desc in GET.
15. Include postedBy select (id, name, avatar).
16. Include _count for claims/comments.
17. Handle GET errors with try/catch.
18. Return JSON response for GET.
19. Export POST function for creating items.
20. Parse JSON body in POST.
21. Validate body with Zod.
22. Create item with prisma.item.create.
23. Set status based on itemType.
24. Include postedBy in response.
25. Handle POST validation errors.
26. Handle POST DB errors.
27. Return 201 status for successful POST.
28. Test GET /api/items endpoint.
29. Test POST /api/items with sample data.
30. Create /api/items/[id] for individual item.
31. Add GET /api/items/[id] route.
32. Add PUT /api/items/[id] for updates.
33. Add DELETE /api/items/[id] for soft deletes.
34. Validate params for dynamic routes.
35. Add auth middleware (placeholder for now).
36. Create /api/comments route.
37. Add POST /api/comments for adding comments.
38. Validate comment schema (message, itemId, userId).
39. Create /api/claims route.
40. Add POST /api/claims for making claims.
41. Validate claim schema (claimType, itemId, userId).
42. Add PUT /api/claims/[id] for approving/rejecting.
43. Update item status on claim resolution.
44. Add error handling for all routes.
45. Add rate limiting (basic).
46. Test all CRUD operations.
47. Add logging for API requests.
48. Document API endpoints.
49. Add API versioning if needed.
50. Mark backend phase complete.

## Phase 3: Frontend (Forms, Pages, Integration)
*(Build UI for posting, browsing, claiming. Integrate with APIs. Add auth UI.)*

1. Create src/app/post/page.tsx for posting form.
2. Import react-hook-form and zodResolver.
3. Create form schema with Zod.
4. Add form fields: title, description, itemType, location.
5. Add images upload (placeholder).
6. Add submit handler for POST /api/items.
7. Handle form validation errors.
8. Show success/error messages.
9. Style form with shadcn components.
10. Create src/app/search/page.tsx for browsing.
11. Fetch items from GET /api/items.
12. Display items in grid/cards.
13. Add loading states.
14. Add error handling for fetch.
15. Add search/filter inputs.
16. Implement client-side filtering.
17. Create item detail page /item/[id].
18. Fetch single item data.
19. Display item info and comments.
20. Add comment form on detail page.
21. Submit comments to POST /api/comments.
22. Add claim button for items.
23. Create claim modal/form.
24. Submit claims to POST /api/claims.
25. Add user dashboard /dashboard.
26. Show user's posted items.
27. Show user's claims.
28. Add edit/delete for own items.
29. Integrate auth UI (login/signup buttons).
30. Add Google OAuth setup (NextAuth).
31. Configure NextAuth providers.
32. Add session management.
33. Protect routes with auth.
34. Add profile page.
35. Upload images with Cloudinary.
36. Configure Cloudinary client.
37. Add image upload to forms.
38. Display images in items.
39. Add pagination for item lists.
40. Add infinite scroll.
41. Add notifications/toasts.
42. Polish responsive design.
43. Add loading skeletons.
44. Test all forms end-to-end.
45. Add E2E tests with Playwright.
46. Optimize performance (lazy loading).
47. Add SEO meta tags.
48. Test accessibility.
49. Final UX review.
50. Mark frontend phase complete.

This roadmap ensures you learn incrementally: setup → validation → integration → testing. Each step builds skills (e.g., API design, form handling, auth). Start with Backend Phase 2, Step 1. Ready to begin? What's your first step?