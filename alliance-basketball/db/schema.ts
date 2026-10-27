import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{id:text('id').primaryKey(),owner:text('owner').notNull(),ownerEmail:text('owner_email').notNull(),revision:integer('revision').notNull().default(0),payload:text('payload').notNull(),updatedAt:text('updated_at').notNull()});
export const workspaceChunks=sqliteTable('workspace_chunks',{snapshot:text('snapshot').notNull(),part:integer('part').notNull(),content:text('content').notNull()},t=>[primaryKey({columns:[t.snapshot,t.part]})]);

