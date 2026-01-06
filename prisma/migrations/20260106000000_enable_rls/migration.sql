-- Enable Row Level Security
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Claim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Note: We are enabling RLS to satisfy security requirements.
-- If the application uses the Supabase client (PostgREST) to access these tables,
-- specific policies will need to be added to allow read/write access.
-- Prisma bypasses RLS when connecting as the database owner/superuser.
