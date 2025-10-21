# Campus Helper

A centralized online platform for university students and staff to report, search, and claim lost or found items on campus. Built with Next.js, Tailwind CSS, shadcn/ui, Supabase, and more.

## Features

- Post lost or found items with images and details
- Search and filter items by category, location, and date
- Secure user authentication via Google
- Claim system for connecting owners and finders
- Admin panel for moderating posts
- Responsive, mobile-friendly PWA

## Tech Stack

- **Frontend**: Next.js 15 + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Auth**: NextAuth.js (Google Provider)
- **File Upload**: Cloudinary
- **Validation**: Zod
- **Deployment**: Vercel + Supabase Cloud

## Getting Started

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd campushelper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `src/app/` - Next.js app router pages and API routes
- `src/components/` - Reusable UI components
- `src/lib/` - Utility functions and configurations
- `roadmap.md` - Project development roadmap

## Contributing

1. Follow the roadmap in `roadmap.md` for development phases.
2. Ensure code follows the project's style and validation rules.
3. Test changes thoroughly before submitting.

## License

This project is licensed under the MIT License.
