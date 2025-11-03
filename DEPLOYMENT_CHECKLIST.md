# 🚀 Deployment Checklist & Cleanup Guide

---

## 🗑️ **FILES TO DELETE BEFORE DEPLOYMENT**

### **1. Test/Demo Routes** ❌ DELETE
```bash
# Delete entire test directory (development/testing only)
rm -rf src/app/test/
```

**Contents to delete:**
- `/src/app/test/animations/` - Animation testing page
- `/src/app/test/errors/` - Error boundary testing
- `/src/app/test/loading/` - Loading state testing
- `/src/app/test/state/` - State management testing
- `/src/app/test/toast/` - Toast notification testing

**Why delete:** These are development-only pages for testing UI components and should not be in production.

---

### **2. Test/Demo Components** ❌ DELETE
```bash
# Delete test components
rm -f src/components/test/ErrorTestPage.tsx
rm -f src/components/ToastDemo.tsx
rm -f src/components/StateTesting.tsx
rm -f src/components/AnimationDemo.tsx
rm -f src/components/LoadingDemo.tsx
rm -rf src/components/test/
```

**Why delete:** Demo components used for testing specific features during development.

---

### **3. Development Documentation** ⚠️ OPTIONAL DELETE
```bash
# OPTIONAL: Delete roadmap (keep if you want historical reference)
rm -f COMPLETE-ROADMAP-100-STEPS.md
```

**Why delete:** The roadmap file is for development reference, not needed in production. **Keep** if you want to track completed features.

**DO NOT DELETE:**
- `README.md` - Keep for project overview
- `SECURITY_AUDIT_REPORT.md` - Keep for security documentation

---

### **4. Git Hooks** ❌ DELETE (if exists)
```bash
# Delete if pre-commit hooks exist (development tooling)
rm -f .git/hooks/pre-commit
rm -f .git/hooks/commit-msg
```

**Why delete:** Pre-commit hooks are development-time only.

---

### **5. Generated/Build Artifacts** ❌ AUTO-DELETED ON BUILD
The following are auto-generated and will be recreated on build:
- `node_modules/.cache/` - Build cache
- `.next/` - Next.js build output
- `dist/` - TypeScript build output (if exists)

**Note:** These will be cleaned automatically by `npm run build`

---

## 🔐 **REQUIRED ENVIRONMENT VARIABLES**

Create `.env.production` with the following variables:

### **1. Authentication (Required)**
```bash
# NextAuth Configuration
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-super-secret-key-here-min-32-chars

# Google OAuth (if using Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**⚠️ CRITICAL:**
- `NEXTAUTH_SECRET` must be at least 32 characters
- Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` must match your production domain exactly

---

### **2. Database (Required)**
```bash
# PostgreSQL Database
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
```

**Format:** `postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME`

---

### **3. Supabase (Required for image uploads)**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Get from:** Supabase Dashboard > Settings > API

---

### **4. Optional Configuration**
```bash
# Production Base URL (for server-side fetches)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

**Note:** If not set, defaults to the domain from request headers.

---

## 📋 **DEPLOYMENT STEPS**

### **Step 1: Clean Up Files**
```bash
# Delete test files
rm -rf src/app/test/
rm -f src/components/test/ErrorTestPage.tsx
rm -f src/components/ToastDemo.tsx
rm -f src/components/StateTesting.tsx
rm -f src/components/AnimationDemo.tsx
rm -f src/components/LoadingDemo.tsx
rm -rf src/components/test/

# Optional: Delete roadmap
# rm -f COMPLETE-ROADMAP-100-STEPS.md

# Clean build cache
rm -rf .next/
rm -rf node_modules/.cache/

echo "✅ Cleanup complete"
```

---

### **Step 2: Set Environment Variables**

**Option A: Create `.env.production`**
```bash
# Create production environment file
cat > .env.production << 'EOF'
# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-min-32-chars
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Database
DATABASE_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Optional
NEXT_PUBLIC_BASE_URL=https://your-domain.com
EOF
```

**Option B: Set in Platform**
If deploying to Vercel/Netlify/Railway, set via platform dashboard.

---

### **Step 3: Build & Verify**
```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Build for production
npm run build

echo "✅ Build successful"
```

**Expected Output:**
```
Route (app)
├─ ○ (Static)
├─ ƒ (Dynamic)
└─ ...

✓ Compiled successfully
✓ Generating static pages
```

---

### **Step 4: Deploy**

#### **Option A: Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
# ... add all other vars

# Redeploy with env vars
vercel --prod
```

#### **Option B: Railway**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway deploy

# Set environment variables
railway variables set NEXTAUTH_SECRET=...
# ... set all other vars
```

#### **Option C: Docker**
```bash
# Build Docker image
docker build -t campus-helper .

# Run container
docker run -p 3000:3000 --env-file .env.production campus-helper
```

---

### **Step 5: Verify Deployment**

Check these URLs work:
- [ ] `https://your-domain.com` - Homepage
- [ ] `https://your-domain.com/auth/login` - Login page
- [ ] `https://your-domain.com/lost-items` - Lost items list
- [ ] `https://your-domain.com/search` - Search page
- [ ] `https://your-domain.com/post` - Post item page

---

## 🔧 **TROUBLESHOOTING**

### **Issue: Build fails with TypeScript errors**
```bash
# Solution: Check all paths are correct
npm run build 2>&1 | grep "error"
# Fix any import path issues
```

### **Issue: "Invalid environment variable"**
```bash
# Solution: Check NEXTAUTH_SECRET is set
echo $NEXTAUTH_SECRET
# Must be at least 32 characters
```

### **Issue: Database connection fails**
```bash
# Solution: Verify DATABASE_URL format
# Must be: postgresql://user:password@host:port/database
```

### **Issue: Images not uploading**
```bash
# Solution: Verify Supabase credentials
# Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## ✅ **POST-DEPLOYMENT CHECKLIST**

### **Functionality Tests**
- [ ] User can sign up
- [ ] User can log in
- [ ] User can post a lost item
- [ ] User can upload an image
- [ ] User can search items
- [ ] User can view item details
- [ ] User can post a claim
- [ ] User can add comments

### **Security Tests**
- [ ] Only authenticated users can create items
- [ ] Users can't edit others' items
- [ ] Admin can access `/admin/*` routes
- [ ] CSRF protection working (try without token - should fail)
- [ ] Rate limiting active (try posting rapidly - should block)

### **Performance Tests**
- [ ] Page load time < 3 seconds
- [ ] Images load correctly
- [ ] No console errors in browser
- [ ] Mobile responsive (test on phone)

---

## 📊 **FILE COUNT COMPARISON**

### **Before Cleanup:**
```
Files: ~150
Test/Demo pages: 5
Test/Demo components: 5
Total size: ~50 MB
```

### **After Cleanup:**
```
Files: ~140
Test/Demo pages: 0
Test/Demo components: 0
Total size: ~45 MB
```

**Savings:** ~10 MB, cleaner codebase, production-ready

---

## 🎯 **QUICK COMMANDS**

```bash
# One-line cleanup command
rm -rf src/app/test/ src/components/test/ src/components/ToastDemo.tsx src/components/StateTesting.tsx src/components/AnimationDemo.tsx src/components/LoadingDemo.tsx

# One-line build command
npm run lint && npm run build

# One-line deploy to Vercel
vercel --prod
```

---

## 📞 **SUPPORT**

If you encounter issues:
1. Check `SECURITY_AUDIT_REPORT.md` for security best practices
2. Review Next.js deployment docs: https://nextjs.org/docs/deployment
3. Check platform-specific deployment guides (Vercel/Netlify/Railway)

---

**Deployment Ready!** 🚀
