import { z } from "zod";

const qqAddress = z.email().max(254).regex(/^[\x21-\x7e]+@(qq|foxmail)\.com$/i).transform((value) => value.toLowerCase());
export const QqTransportConfigurationSchema = z.strictObject({ enabled: z.literal(true), transport: z.literal("qq-smtp"), address: qqAddress });
const origin = z.url({ protocol: /^https$/ }).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
}, "https-origin-required").transform((value) => new URL(value).origin);
export const EmailConfigurationSchema = z.discriminatedUnion("enabled", [
  z.strictObject({ enabled: z.literal(false) }),
  z.strictObject({ enabled: z.literal(true), transport: z.literal("qq-smtp"), address: qqAddress,
    publicBaseUrl: origin, startBusinessDate: z.iso.date() }),
]);
export type EmailConfiguration = z.infer<typeof EmailConfigurationSchema>;
export type EnabledEmailConfiguration = Extract<EmailConfiguration, { enabled: true }>;
export const notificationKindSchema = z.enum(["daily-brief", "significant-correction"]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;
export const emailBudgets = { pdfBytes: 5 * 1024 * 1024, mimeBytes: 8 * 1024 * 1024, pdfWaitMs: 120_000,
  retryDelayMs: 300_000, maxAttempts: 3, transportTimeoutMs: 20 * 60_000, leaseMs: 22 * 60_000 } as const;
export type EmailOutcome = {
  state: "accepted" | "rejected" | "unknown" | "retryable";
  reason: "smtp-accepted" | "smtp-rejected" | "smtp-temporary-rejection" | "smtp-before-submit-failed" |
    "smtp-auth-failed" | "smtp-response-unconfirmed" | "smtp-interrupted" | "smtp-deadline" | "transport-failed";
  // A local RFC Message-ID is separate from any provider-issued identifier.
  providerMessageId?: string;
  responseCode?: number;
};
export interface EmailTransport {
  readonly name: string;
  readonly provenance: "live" | "injected";
  // Success means final SMTP acceptance, never mailbox delivery. No automatic retry inside an adapter.
  send(message: { raw: Buffer; from: string; to: string; messageId: string }, signal?: AbortSignal): Promise<EmailOutcome>;
  close(): void;
}
export interface EmailOptions { configuration: unknown; transport: EmailTransport }
