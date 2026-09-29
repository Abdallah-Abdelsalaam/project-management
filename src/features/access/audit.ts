import { headers } from "next/headers";
import { auditLog } from "@/db/schema";
import type { Executor } from "@/db";

/**
 * The audit writer — the only code in the application that writes
 * `audit_log`, and there is deliberately no reader, no updater and no deleter
 * beside it. The activity screen (session 18) reads; nothing ever edits. The
 * log tells the user it cannot be changed from inside the system, and a file
 * that exposes only an insert is how that promise is kept in code rather than
 * in prose.
 *
 * **Every call takes an executor**, and the callers pass the transaction that
 * is making the change. A permission grant that committed while its audit row
 * failed would leave a system where someone gained access and nobody can say
 * who granted it — so the change and its explanation commit together or
 * neither does.
 */

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId: string;
  field?: string | null;
  valueFrom?: unknown;
  valueTo?: unknown;
};

/** Who and from where — read once per request, not once per row. */
export type AuditContext = {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
};

/**
 * Reads the request context an audit row records alongside the change.
 *
 * `x-forwarded-for` is a list when the request crossed more than one proxy;
 * the first entry is the client. It is attacker-controllable in principle, so
 * it is recorded as evidence and never used to make a decision.
 */
export async function auditContext(actorId: string | null): Promise<AuditContext> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");

  return {
    actorId,
    ip: forwarded?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

/**
 * Appends rows. A no-op on an empty list, so a save that changed nothing
 * writes nothing — an audit log padded with non-events is one nobody reads.
 */
export async function writeAudit(
  client: Executor,
  context: AuditContext,
  entries: readonly AuditEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  await client.insert(auditLog).values(
    entries.map((entry) => ({
      actorId: context.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      field: entry.field ?? null,
      valueFrom: entry.valueFrom ?? null,
      valueTo: entry.valueTo ?? null,
      ip: context.ip,
      userAgent: context.userAgent,
    })),
  );
}
