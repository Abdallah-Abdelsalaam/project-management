import { relations } from "drizzle-orm";
import { index, json, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { id, ref, tsNow } from "./columns";
import { user } from "./auth";

/**
 * The audit log — written from session 3, read by the screen in session 18.
 *
 * Append-only. No update or delete path exists in the application, and
 * `insights/activity-log.html` tells the user so in as many words; no code
 * path may contradict that. `src/features/access/audit.ts` is the only writer,
 * and it exposes an insert and nothing else.
 *
 * Rows are written **inside the same transaction** as the change they
 * describe. That is the whole point: a permission grant that committed while
 * its audit row failed would leave a system where someone gained access and
 * nobody can say who gave it to them. One transaction means the change and its
 * explanation cannot come apart.
 *
 * `valueFrom` / `valueTo` are JSON so a value of any shape survives — the
 * activity screen renders them as a `from → to` diff. For a permission cell
 * they are booleans; for a renamed role, strings.
 */
export const auditLog = mysqlTable(
  "audit_log",
  {
    id: id(),
    /** Null for a system action — a seed, a migration, a scheduled job. */
    actorId: ref().references(() => user.id, { onDelete: "set null" }),
    /** `permission.granted`, `role.created`, `task.status_changed`, … */
    action: varchar({ length: 64 }).notNull(),
    entityType: varchar({ length: 32 }).notNull(),
    entityId: varchar({ length: 128 }).notNull(),
    /** Which attribute changed, when the action is a field-level edit. */
    field: varchar({ length: 64 }),
    valueFrom: json(),
    valueTo: json(),
    ip: varchar({ length: 64 }),
    userAgent: text(),
    createdAt: tsNow(),
  },
  (table) => [
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_actor_id_idx").on(table.actorId),
    index("audit_log_created_at_idx").on(table.createdAt),
    index("audit_log_action_idx").on(table.action),
  ],
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, { fields: [auditLog.actorId], references: [user.id] }),
}));
