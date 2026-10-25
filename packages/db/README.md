# @sonara/db

Prisma ORM package for the Sonara database on PostgreSQL.

This package provides a type-safe Prisma client and schema that is **100% synchronized** with [`infra/postgres/init.sql`](../../infra/postgres/init.sql).

## Features

- **PostgreSQL Connection**: Configured to read `DATABASE_URL` from the environment.
- **Full Model Mapping**: Models directly mirror all tables, columns, indexes, and foreign key relations initialized by `init.sql`:
  - `User` (`users`)
  - `Session` (`sessions`)
  - `PlayHistory` (`play_history`)
  - `Playlist` (`playlists`)
  - `PlaylistItem` (`playlist_items`)
  - `UserPreference` (`user_preferences`)
  - `UserLibrary` (`user_library`)
- **Singleton Client**: Pre-configured PrismaClient singleton prevents duplicate instances during Next.js fast-refresh / development.

## Usage

### In Next.js (`apps/web`)

```typescript
import { prisma } from '@sonara/db';
// Or via the web alias:
import prisma from '@/lib/prisma';

// Example: Query users
const users = await prisma.user.findMany({
  include: {
    playlists: true,
    preferences: true,
  },
});
```

## Useful Commands

From the monorepo root:

- `npm run db:generate` (or `make prisma-gen`): Regenerate Prisma Client from `schema.prisma`.
- `npm run db:push` (or `make prisma-push`): Push schema updates to the PostgreSQL database.
- `npm run db:migrate` (or `make prisma-migrate`): Run migrations in development.
- `npm run db:studio` (or `make prisma-studio`): Open Prisma Studio to inspect and edit database records.
