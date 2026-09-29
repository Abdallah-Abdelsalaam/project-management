/**
 * Drizzle schema barrel.
 *
 * Tables land here one vertical slice at a time, matching docs/03-DATABASE.md:
 *   session 2  auth (user, session, account, verification, trusted_device)
 *   session 3  role, permission, role_permission
 *   session 4  department, task_type, task_status
 *   session 5  employee profile fields
 *   session 6  team, team_member
 *   session 7+ task and everything hanging off it
 *
 * Every foreign key gets an index, and every column a list filters or sorts
 * on gets one too.
 */

export {};
