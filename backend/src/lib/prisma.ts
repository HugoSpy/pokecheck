// Shared PrismaClient singleton. Every module loaded by the server process must
// import this instance instead of calling `new PrismaClient()`: each client owns
// a connection pool, and ~24 separate instances were enough to exhaust
// PostgreSQL's max_connections (standalone scripts in prisma/, scripts/ and
// jobs/ run in their own short-lived process and keep their own client).
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
