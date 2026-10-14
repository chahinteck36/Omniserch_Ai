import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table (keyed by Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  tier: text('tier').notNull().default('free'), // 'free' | 'pro' | 'enterprise'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Activation / License codes
export const activationCodes = pgTable('activation_codes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  tier: text('tier').notNull(), // 'pro' | 'enterprise'
  duration: text('duration').notNull(), // '1_month' | '3_months' | '1_year' | 'lifetime'
  isUsed: boolean('is_used').notNull().default(false),
  usedByEmail: text('used_by_email'),
  usedByUid: text('used_by_uid'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
  usedAt: timestamp('used_at'),
  expiresAt: timestamp('expires_at'),
});

// Authoritative user quotas (atomic search quota tracking)
export const userQuotas = pgTable('user_quotas', {
  id: serial('id').primaryKey(),
  identifier: text('identifier').notNull().unique(), // email or hashed IP
  identifierType: text('identifier_type').notNull(), // 'email' | 'ip'
  usedCount: integer('used_count').notNull().default(0),
  totalLimit: integer('total_limit').notNull().default(10),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Persistent research sessions and search history
export const researchSessions = pgTable('research_sessions', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  userEmail: text('user_email'),
  userUid: text('user_uid'),
  query: text('query').notNull(),
  mode: text('mode').notNull(), // 'fast' | 'deep' | 'battle' | 'code'
  status: text('status').notNull().default('pending'), // 'pending' | 'in_progress' | 'completed' | 'failed'
  resultJson: text('result_json'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Admin authentication sessions
export const adminSessions = pgTable('admin_sessions', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(researchSessions),
}));

export const researchSessionsRelations = relations(researchSessions, ({ one }) => ({
  user: one(users, {
    fields: [researchSessions.userUid],
    references: [users.uid],
  }),
}));
