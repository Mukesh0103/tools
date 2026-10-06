import "server-only";
import { timingSafeEqual } from "node:crypto";

/** True when the request carries `Authorization: Bearer $CRON_SECRET`. Always false without a secret. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return (
    header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  );
}
