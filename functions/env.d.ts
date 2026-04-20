/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ADMIN_USER_IDS: string;
  ADMIN_EMAIL?: string;
  SITE_URL: string;
  SITE_NAME: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  UPLOAD_API_KEY?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
}

type PagesFunction<E = Env> = (context: {
  request: Request;
  env: E;
  ctx: ExecutionContext;
  params: Record<string, string>;
}) => Response | Promise<Response>;
