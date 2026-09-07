# Project File Layout

## Root Directory Structure

```
investorlogs-official-site/
├── prisma/
│   └── schema.prisma          # Prisma database schema with all entities
├── public/                    # Static assets (images, fonts, etc.)
├── src/
│   ├── app/                   # Next.js App Router pages and layouts
│   │   ├── dashboard/         # Dashboard pages
│   │   │   ├── layout.tsx     # Dashboard layout with header and theme toggle
│   │   │   └── page.tsx       # Dashboard home page with stats
│   │   ├── globals.css        # Global styles with theme variables
│   │   ├── layout.tsx         # Root layout with theme provider
│   │   └── page.tsx           # Landing page
│   ├── components/
│   │   ├── ui/                # Shadcn UI components
│   │   │   ├── alert.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── toast.tsx
│   │   ├── link-button.tsx    # Reusable link button component
│   │   ├── theme-provider.tsx # Theme provider component
│   │   └── theme-toggle.tsx   # Dark/light mode toggle
│   └── lib/
│       ├── prisma.ts          # Prisma Client singleton
│       └── utils.ts           # Utility functions (Shadcn)
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── AGENTS.md                  # Devin CLI configuration
├── components.json            # Shadcn UI configuration
├── DATABASE_SETUP.md          # Database setup instructions
├── eslint.config.mjs          # ESLint configuration
├── next.config.ts             # Next.js configuration
├── package.json               # Project dependencies
├── postcss.config.mjs         # PostCSS configuration
├── prisma.config.ts           # Prisma CLI configuration
├── PROJECT_STRUCTURE.md       # This file
├── README.md                  # Project documentation
└── tsconfig.json              # TypeScript configuration
```

## Key Directories Explained

### `/prisma/`
- Contains the database schema definition
- Migration files will be generated here when running `prisma migrate dev`

### `/src/app/`
- Next.js App Router directory
- Contains all pages and layouts using the file-based routing system
- `layout.tsx` files define UI that wraps child pages
- `page.tsx` files are the actual page components

### `/src/components/`
- Reusable React components
- `ui/` contains Shadcn UI base components
- Custom components like `theme-toggle.tsx` and `link-button.tsx`

### `/src/lib/`
- Utility functions and configurations
- `prisma.ts` contains the Prisma Client singleton for database access
- `utils.ts` contains helper functions (e.g., `cn` for class names)

### `/public/`
- Static assets that are served directly
- Images, fonts, favicon, etc.

## Database Schema Overview

The Prisma schema includes the following models:

1. **User** - User accounts with authentication and wallet functionality
2. **WalletTransaction** - Transaction tracking (DEPOSIT/PURCHASE/REFUND)
3. **AccountCategory** - Categories for organizing digital accounts
4. **DigitalAccount** - Digital accounts marketplace items
5. **SmsOrder** - SMS verification orders
6. **SmmOrder** - Social Media Marketing orders

Each model includes appropriate relations, indexes, and enums for type safety.

## Tech Stack Summary

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn UI
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js (to be implemented)
- **Theme**: next-themes for dark/light mode

## Next Steps

After completing Phase 0, the project is ready for:

1. **Phase 1**: Authentication implementation with NextAuth.js
2. **Phase 2**: API routes for each entity
3. **Phase 3**: Dashboard features and UI components
4. **Phase 4**: Integration with external services (SMS, SMM)
5. **Phase 5**: Payment processing integration

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio

# Add Shadcn UI components
npx shadcn@latest add [component-name]

# Build for production
npm run build

# Start production server
npm start
```