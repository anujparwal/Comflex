/**
 * Prisma Client Singleton
 * 
 * Ensures only one PrismaClient instance exists across the application.
 * Import this everywhere instead of creating new PrismaClient instances.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
