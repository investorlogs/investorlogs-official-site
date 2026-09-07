# Database Setup Instructions

## Prerequisites
- PostgreSQL database installed and running
- Node.js and npm installed

## Environment Setup

1. Create a `.env` file in the project root (copy from `.env.example`):
```bash
cp .env.example .env
```

2. Update the `DATABASE_URL` in your `.env` file with your PostgreSQL credentials:
```
DATABASE_URL="postgresql://your_username:your_password@localhost:5432/investorlogs_db?schema=public"
```

3. Set your NextAuth credentials:
```
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secure-random-string"
```

## Running Migrations

After setting up your `.env` file, run the following commands:

1. Generate Prisma Client:
```bash
npx prisma generate
```

2. Create the database and run migrations:
```bash
npx prisma migrate dev --name init
```

3. (Optional) Seed the database with initial data:
```bash
npx prisma db seed
```

## Database Schema

The database includes the following models:
- `User` - User accounts with authentication and wallet functionality
- `WalletTransaction` - Transaction tracking for deposits, purchases, and refunds
- `AccountCategory` - Categories for organizing digital accounts
- `DigitalAccount` - Digital accounts marketplace items
- `SmsOrder` - SMS verification orders
- `SmmOrder` - Social Media Marketing orders

## Prisma Studio

To interact with your database visually:
```bash
npx prisma studio
```

This will open a web interface at `http://localhost:5555` to view and edit your database data.