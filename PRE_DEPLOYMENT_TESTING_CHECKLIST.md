# Pre-Deployment Testing Checklist

## Overview
This checklist ensures all critical functionality works correctly before deploying to production. Complete each section thoroughly.

## 🔐 Authentication & Session Management

### Login Flow
- [ ] **Test user login with valid credentials**
  - [ ] Navigate to `/auth/login`
  - [ ] Enter valid email/password
  - [ ] Verify successful redirect to dashboard
  - [ ] Check user data displays correctly (name, email, avatar)
  
- [ ] **Test login with invalid credentials**
  - [ ] Enter wrong password
  - [ ] Verify error message displays
  - [ ] Verify user remains on login page
  
- [ ] **Test login state persistence**
  - [ ] Login successfully
  - [ ] Refresh browser page
  - [ ] Verify still logged in
  - [ ] Close/reopen browser tab
  - [ ] Verify still logged in

### Logout Flow
- [ ] **Test logout functionality**
  - [ ] Click logout button
  - [ ] Verify redirect to home page
  - [ ] Verify user data no longer displays
  - [ ] Try accessing protected route
  - [ ] Verify redirected to login

### Session Security
- [ ] **Test session expiration**
  - [ ] Login successfully
  - [ ] Wait for session timeout (or test manual expiration)
  - [ ] Try accessing protected API endpoint
  - [ ] Verify 401 error returns

## 📝 Core Functionality

### Comments System
- [ ] **View Comments**
  - [ ] Navigate to any item page with comments
  - [ ] Verify comments load without errors
  - [ ] Verify user avatars and names display
  - [ ] Verify timestamps display correctly
  
- [ ] **Create Comments (POST)**
  - [ ] Add new comment to item
  - [ ] Verify comment appears immediately
  - [ ] Test with empty message (should fail)
  - [ ] Test with very long message (should truncate/validate)
  
- [ ] **Edit Comments**
  - [ ] Edit your own comment
  - [ ] Verify changes save correctly
  - [ ] Test edit on deleted item (should be disabled)
  
- [ ] **Delete Comments**
  - [ ] Delete your own comment
  - [ ] Verify comment removed from list
  - [ ] Test delete on other user's comment (should be disabled)

### Items Management
- [ ] **View Items**
  - [ ] Navigate to lost items page
  - [ ] Verify items display with correct data
  - [ ] Test pagination/loading
  
- [ ] **Create New Item**
  - [ ] Post new lost/found item
  - [ ] Verify item appears in list
  - [ ] Test with missing required fields
  
- [ ] **Edit Items**
  - [ ] Edit your own item
  - [ ] Test edit on other user's item (should be disabled)

### Search Functionality
- [ ] **Search Items**
  - [ ] Use search functionality
  - [ ] Verify results display correctly
  - [ ] Test with no results
  - [ ] Test with special characters

## 🔒 Security Testing

### CSRF Protection
- [ ] **Test CSRF tokens on POST requests**
  - [ ] Submit comment (should require CSRF token)
  - [ ] Submit new item (should require CSRF token)
  - [ ] Edit profile (should require CSRF token)
  
- [ ] **Test CSRF validation**
  - [ ] Submit POST request without CSRF token
  - [ ] Verify 403 error returns

### Authorization
- [ ] **Test unauthorized access**
  - [ ] Try accessing API endpoints without login
  - [ ] Verify 401 error returns
  - [ ] Try accessing other user's resources
  - [ ] Verify appropriate access denied

### Input Validation
- [ ] **Test XSS protection**
  - [ ] Submit comment with script tags
  - [ ] Submit item with malicious content
  - [ ] Verify content is sanitized
  
- [ ] **Test SQL injection protection**
  - [ ] Submit items with special characters
  - [ ] Use search with SQL injection attempts
  - [ ] Verify appropriate handling

## 🌐 API Endpoints Testing

### Authentication Endpoints
- [ ] **Test `/api/auth/session`**
  - [ ] GET with valid session (should return user data)
  - [ ] GET without session (should return null)
  
- [ ] **Test `/api/auth/signin`**
  - [ ] POST with valid credentials (should succeed)
  - [ ] POST with invalid credentials (should fail)
  - [ ] POST with missing fields (should fail)

### Comments Endpoints
- [ ] **Test `GET /api/comments?itemId=xxx`**
  - [ ] With valid session (should return comments)
  - [ ] Without session (should return 401)
  - [ ] With invalid itemId (should return 404)
  
- [ ] **Test `POST /api/comments`**
  - [ ] With valid session and CSRF (should create comment)
  - [ ] Without session (should return 401)
  - [ ] Without CSRF token (should return 403)
  - [ ] With invalid data (should return 400)
  
- [ ] **Test `PUT /api/comments/:id`**
  - [ ] Edit own comment (should succeed)
  - [ ] Edit other user's comment (should fail)
  - [ ] Edit non-existent comment (should fail)
  
- [ ] **Test `DELETE /api/comments/:id`**
  - [ ] Delete own comment (should succeed)
  - [ ] Delete other user's comment (should fail)
  - [ ] Delete non-existent comment (should fail)

### Items Endpoints
- [ ] **Test `GET /api/items`**
  - [ ] Fetch items list
  - [ ] Test with search parameters
  - [ ] Test pagination
  
- [ ] **Test `POST /api/items`**
  - [ ] Create new item with valid data
  - [ ] Test with missing required fields
  - [ ] Test without authentication
  
- [ ] **Test `PUT /api/items/:id`**
  - [ ] Edit own item (should succeed)
  - [ ] Edit other user's item (should fail)
  
- [ ] **Test `DELETE /api/items/:id`**
  - [ ] Delete own item (should succeed)
  - [ ] Delete other user's item (should fail)

## 🎨 Frontend Testing

### User Interface
- [ ] **Test responsive design**
  - [ ] Desktop view (1920x1080)
  - [ ] Tablet view (768x1024)
  - [ ] Mobile view (375x667)
  
- [ ] **Test navigation**
  - [ ] All navigation links work
  - [ ] Breadcrumbs display correctly
  - [ ] Mobile menu functions properly
  
- [ ] **Test form submissions**
  - [ ] Login form validation
  - [ ] Comment form validation
  - [ ] Item creation form validation
  
- [ ] **Test error states**
  - [ ] Network error handling
  - [ ] Invalid input handling
  - [ ] Loading states display

### JavaScript Functionality
- [ ] **Test client-side routing**
  - [ ] Navigate between pages
  - [ ] Browser back/forward buttons
  - [ ] Direct URL access
  
- [ ] **Test real-time updates**
  - [ ] Comments update after posting
  - [ ] UI updates after edits/deletes
  - [ ] No console errors

## 🧪 Cross-Browser Testing

- [ ] **Chrome** (Latest)
  - [ ] All functionality works
  - [ ] No console errors
  - [ ] Proper styling
  
- [ ] **Firefox** (Latest)
  - [ ] All functionality works
  - [ ] No console errors
  - [ ] Proper styling
  
- [ ] **Safari** (Latest)
  - [ ] All functionality works
  - [ ] No console errors
  - [ ] Proper styling
  
- [ ] **Edge** (Latest)
  - [ ] All functionality works
  - [ ] No console errors
  - [ ] Proper styling

## ⚡ Performance Testing

### Load Times
- [ ] **Test page load speeds**
  - [ ] Home page loads in < 3 seconds
  - [ ] Item pages load in < 2 seconds
  - [ ] Dashboard loads in < 2 seconds
  
- [ ] **Test API response times**
  - [ ] Comments API responds in < 1 second
  - [ ] Items API responds in < 1 second
  - [ ] Authentication API responds in < 1 second

### Resource Usage
- [ ] **Test memory usage**
  - [ ] No memory leaks during navigation
  - [ ] Reasonable memory footprint
  
- [ ] **Test image loading**
  - [ ] Avatars load correctly
  - [ ] Image optimization works
  - [ ] No broken image links

## 📱 Mobile Testing

- [ ] **Test touch interactions**
  - [ ] Buttons respond to touch
  - [ ] Forms work on mobile keyboards
  - [ ] Scrolling works smoothly
  
- [ ] **Test mobile-specific features**
  - [ ] Camera access for item photos
  - [ ] Geolocation if applicable
  - [ ] PWA functionality if applicable

## 🔄 Integration Testing

### Third-party Services
- [ ] **Test Google OAuth** (if applicable)
  - [ ] Sign in with Google works
  - [ ] User data imports correctly
  - [ ] Logout works properly
  
- [ ] **Test Email Service** (if applicable)
  - [ ] Welcome emails sent
  - [ ] Password reset emails sent
  - [ ] Email templates render correctly

### Database Operations
- [ ] **Test data persistence**
  - [ ] Comments save correctly
  - [ ] Items save correctly
  - [ ] User data persists
  
- [ ] **Test data relationships**
  - [ ] Comments link to correct items
  - [ ] Items link to correct users
  - [ ] No orphaned records

## 🚀 Production-Specific Testing

### Environment Configuration
- [ ] **Test production environment variables**
  - [ ] NEXTAUTH_SECRET is set
  - [ ] NEXTAUTH_URL is correct
  - [ ] Database connection works
  - [ ] Google OAuth keys are set (if applicable)
  
- [ ] **Test production security headers**
  - [ ] HTTPS redirects work
  - [ ] Security headers are present
  - [ ] CORS is configured correctly

### Vercel Deployment
- [ ] **Test Vercel-specific functionality**
  - [ ] Build process completes successfully
  - [ ] Environment variables are accessible
  - [ ] API routes respond correctly
  - [ ] Static assets load properly

## 📊 Error Monitoring

### Console Errors
- [ ] **Test for JavaScript errors**
  - [ ] No console errors on page load
  - [ ] No console errors during interactions
  - [ ] API errors are handled gracefully
  
- [ ] **Test error boundaries**
  - [ ] React error boundaries catch errors
  - [ ] User-friendly error messages display
  - [ ] Application doesn't crash

### Network Errors
- [ ] **Test network failure scenarios**
  - [ ] Offline functionality (if applicable)
  - [ ] Slow network performance
  - [ ] Network timeout handling

## 🧪 Testing Tools & Commands

### Manual Testing Commands
```bash
# Test authentication flow
curl -X POST https://campushelper.vercel.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

# Test comments API
curl -X GET "https://campushelper.vercel.app/api/comments?itemId=test" \
  -H "Cookie: next-auth.session-token=your-token-here"

# Test CSRF protection
curl -X POST https://campushelper.vercel.app/api/comments \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=your-token-here" \
  -d '{"message":"Test comment","itemId":"test-item"}'
```

### Browser Console Testing
```javascript
// Test authentication
fetch('/api/auth/session')
  .then(r => r.json())
  .then(console.log);

// Test comments API
fetch('/api/comments?itemId=test', { credentials: 'include' })
  .then(r => console.log('Status:', r.status, 'Response:', r.json()));
```

## 📋 Pre-Deployment Checklist

### Code Quality
- [ ] **Lint check passes**
  - [ ] No ESLint errors
  - [ ] No TypeScript errors
  - [ ] Code formatting is consistent
  
- [ ] **Build process**
  - [ ] Next.js build succeeds
  - [ ] No build warnings
  - [ ] Bundle size is reasonable

### Security Review
- [ ] **Security audit**
  - [ ] No sensitive data in code
  - [ ] Environment variables are secure
  - [ ] API endpoints are protected
  
- [ ] **Dependency check**
  - [ ] All dependencies are up to date
  - [ ] No known security vulnerabilities
  - [ ] Unused dependencies removed

## ✅ Final Testing Steps

Before pushing to production, ensure:

1. **All critical paths are tested** (login → view item → comment → logout)
2. **Error scenarios are handled** (network errors, invalid data, etc.)
3. **Performance is acceptable** (load times, API responses)
4. **Security is verified** (authentication, authorization, CSRF)
5. **Cross-browser compatibility** is confirmed
6. **Mobile responsiveness** works properly
7. **No console errors** in any browser
8. **All environment variables** are configured correctly

## 🚨 Rollback Plan

If issues are found in production:
1. Identify the specific issue
2. Revert to previous deployment if necessary
3. Fix issues in development
4. Test thoroughly
5. Redeploy with fixes

---

**Remember**: It's better to spend extra time testing than to have issues in production. Take your time and be thorough!
