import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Resend } from "resend";
import { mailEnv } from "@/lib/env";
import { twoFactorPolicy } from "@/lib/policy";

/**
 * Transactional email for the auth flow: the second-factor code and the
 * password-reset link.
 *
 * Two deliberate choices.
 *
 * **No key means no send, not a crash.** A developer without a Resend key still
 * has to be able to walk the whole sign-in flow, so the code is written to the
 * server log instead. That is a development affordance and it announces itself
 * loudly; it is never reachable in production because `RESEND_API_KEY` is set
 * in all three Vercel environments.
 *
 * **Failing to send never fails the request.** The caller learns nothing about
 * whether the address exists or the provider was reachable, because leaking
 * either turns the sign-in and forgot-password screens into account-existence
 * oracles. Delivery problems go to the log; the user sees the same neutral
 * confirmation either way.
 *
 * ## The outbox
 *
 * When `AUTH_MAIL_OUTBOX` names a file, every message is also appended to it as
 * one JSON object per line. That is how the E2E suite reads a verification code:
 * the code is hashed in the database and sent by email, so there is otherwise no
 * way for a test to learn it, and a test seam is better than weakening the
 * storage.
 *
 * It is opt-in by environment variable and nothing sets it outside a test run —
 * the same contract as `DATABASE_URL`. It logs loudly whenever it is active, so
 * an outbox left on by accident announces itself on the first email rather than
 * silently accumulating credentials in a file.
 *
 * The markup is inlined, table-free and `dir="rtl"`: email clients have no
 * cascade worth relying on, so the design tokens are written as literal values
 * here rather than referenced. This is the one place in the codebase exempt
 * from the design-token rule, and the values are copied from
 * `src/app/globals.css`.
 */

let client: Resend | null = null;

function resend(): Resend | null {
  const { RESEND_API_KEY } = mailEnv();
  if (!RESEND_API_KEY) return null;
  client ??= new Resend(RESEND_API_KEY);
  return client;
}

type Message = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Appends a message to the development outbox, if one is configured. Never
 * throws: a broken outbox path must not break the flow it is observing.
 */
async function appendToOutbox(message: Message): Promise<void> {
  const path = process.env.AUTH_MAIL_OUTBOX;
  if (!path) return;

  console.warn(
    `[auth/mail] AUTH_MAIL_OUTBOX is set — writing "${message.subject}" to ${path}. ` +
      "This file contains live verification codes and reset links; it must never be set in a deployed environment.",
  );

  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify({ ...message, at: Date.now() })}\n`, "utf8");
  } catch (error) {
    console.error("[auth/mail] could not write to the outbox:", error);
  }
}

async function send(message: Message): Promise<void> {
  const { EMAIL_FROM } = mailEnv();
  const transport = resend();

  await appendToOutbox(message);

  if (!transport) {
    console.warn(
      `[auth/mail] RESEND_API_KEY is not set — not sending "${message.subject}" to ${message.to}.\n` +
        `[auth/mail] ${message.text}`,
    );
    return;
  }

  const { error } = await transport.emails.send({
    from: `إدارة المشاريع · مجموعة نُوى <${EMAIL_FROM}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (error) {
    // Swallowed on purpose: see the note at the top of this file.
    console.error(`[auth/mail] failed to send "${message.subject}":`, error);
  }
}

const SHELL_STYLE = [
  "margin:0",
  "padding:24px",
  "background-color:#f4f2f7",
  "font-family:'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif",
  "color:#14121a",
  "line-height:1.6",
].join(";");

const CARD_STYLE = [
  "max-width:520px",
  "margin:0 auto",
  "padding:32px",
  "background-color:#ffffff",
  "border:1px solid #e4e1e9",
  "border-radius:8px",
].join(";");

/** Borders, not shadows — the same rule the application's tokens encode. */
function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${SHELL_STYLE}">
  <div style="${CARD_STYLE}">
    <p style="margin:0 0 24px;font-size:13px;color:#8b8599">إدارة المشاريع · مجموعة نُوى</p>
    ${body}
  </div>
</body>
</html>`;
}

/**
 * The second-factor code.
 *
 * The digits are rendered LTR with wide letter-spacing and tabular figures:
 * a six-digit code inside an RTL paragraph is read in the wrong order by some
 * clients, and misreading it is indistinguishable from a wrong code.
 */
export async function sendTwoFactorCode({
  to,
  name,
  code,
}: {
  to: string;
  name: string;
  code: string;
}): Promise<void> {
  const minutes = twoFactorPolicy().codeLifetimeMinutes;

  await send({
    to,
    subject: `رمز التحقق: ${code}`,
    text: `مرحبًا ${name}،\n\nرمز التحقق الخاص بك هو ${code}. الرمز صالح لمدة ${minutes} دقائق.\n\nإن لم تكن أنت من طلب الرمز، تجاهل هذه الرسالة وأبلغ مسؤول النظام.`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:600">رمز التحقق</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#625d72">
        مرحبًا ${escapeHtml(name)}، استخدم هذا الرمز لإكمال تسجيل الدخول.
      </p>
      <p dir="ltr" style="margin:0 0 24px;padding:16px;background-color:#fbfafc;border:1px solid #e4e1e9;border-radius:6px;font-size:30px;font-weight:600;letter-spacing:8px;text-align:center;font-variant-numeric:tabular-nums lining-nums">
        ${escapeHtml(code)}
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#625d72">
        الرمز صالح لمدة ${minutes} دقائق، ويُستخدم مرة واحدة.
      </p>
      <p style="margin:0;font-size:12px;color:#8b8599">
        إن لم تكن أنت من طلب الرمز، تجاهل هذه الرسالة وأبلغ مسؤول النظام.
      </p>
    `),
  });
}

/** The password-reset link. One hour, single use — as the screen promises. */
export async function sendPasswordResetLink({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  await send({
    to,
    subject: "إعادة تعيين كلمة المرور",
    text: `مرحبًا ${name}،\n\nافتح هذا الرابط لتعيين كلمة مرور جديدة:\n${url}\n\nالرابط صالح لمدة ساعة واحدة ويُستخدم مرة واحدة. إن لم تكن أنت من طلب إعادة التعيين، تجاهل هذه الرسالة وأبلغ مسؤول النظام.`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:600">إعادة تعيين كلمة المرور</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#625d72">
        مرحبًا ${escapeHtml(name)}، اطلب أحدهم تعيين كلمة مرور جديدة لحسابك.
      </p>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background-color:#e7033e;color:#ffffff;border-radius:6px;font-size:15px;font-weight:600;text-decoration:none">
          تعيين كلمة مرور جديدة
        </a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#625d72">
        الرابط صالح لمدة ساعة واحدة ويُستخدم مرة واحدة. تعيين كلمة مرور جديدة يُنهي جلساتك المفتوحة
        على كل الأجهزة ويُلغي ثقة الأجهزة المحفوظة.
      </p>
      <p style="margin:0;font-size:12px;color:#8b8599">
        إن لم تكن أنت من طلب إعادة التعيين، تجاهل هذه الرسالة وأبلغ مسؤول النظام.
      </p>
    `),
  });
}

/** Minimal escaping — every interpolated value here is a name, code or URL. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
