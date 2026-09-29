import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Better Auth's catch-all handler. Resolved per request rather than at module
 * load, so a missing BETTER_AUTH_SECRET surfaces as a request error instead of
 * breaking the whole build.
 */
export async function GET(request: Request) {
  return toNextJsHandler(auth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(auth()).POST(request);
}
