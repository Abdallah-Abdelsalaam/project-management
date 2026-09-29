/**
 * Drizzle schema barrel.
 *
 * Tables land here one vertical slice at a time, matching docs/03-DATABASE.md:
 *   session 2  auth (user, session, account, verification, two_factor,
 *              trusted_device, login_attempt, password_history)
 *   session 3  role, permission, role_permission, audit_log
 *   session 4  department, task_type, task_status
 *   session 5  employee profile fields
 *   session 6  team, team_member
 *   session 7+ task and everything hanging off it
 *
 * Every foreign key gets an index, and every column a list filters or sorts
 * on gets one too.
 */

// `./columns` is deliberately NOT re-exported. It is an internal helper, and
// it imports `node:crypto` — so exposing it here would let any client
// component that imports a type from this barrel drag Node built-ins into the
// browser bundle. Schema files import it by relative path.
export * from "./access";
export * from "./auth";
export * from "./system";
