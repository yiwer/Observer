import SMTPConnection from "nodemailer/lib/smtp-connection";
import { EmailConfigurationSchema, QqTransportConfigurationSchema, emailBudgets, type EmailOutcome, type EmailTransport } from "./email-contracts.ts";

/** Lazy secrets, fixed TLS endpoint, no verify/preflight and no retries or receipts invented. */
export function createQqEmailTransport(configuration: unknown, readKey: () => string | undefined): EmailTransport {
  const checked = EmailConfigurationSchema.parse(configuration);
  if (!checked.enabled) throw new Error("email-disabled");
  return createQqAttachmentTransport({ enabled: true, transport: checked.transport, address: checked.address }, readKey);
}

/** Explicit local attachment delivery requires no externally hosted download URL. */
export function createQqAttachmentTransport(configuration: unknown, readKey: () => string | undefined): EmailTransport {
  const checked = QqTransportConfigurationSchema.parse(configuration);
  let closed = false;
  const active = new Set<() => void>();
  return {
    name: "qq-smtp", provenance: "live",
    async send(message, signal) {
      if (closed || signal?.aborted) return { state: "retryable", reason: "smtp-before-submit-failed" };
      if (message.from !== checked.address || message.to !== checked.address || message.raw.length > emailBudgets.mimeBytes)
        return { state: "rejected", reason: "smtp-before-submit-failed" };
      // Read only after the enabled, complete configuration and bounded MIME are validated.
      const key = readKey();
      if (!key || key.length > 1024 || /[\r\n\0]/.test(key)) return { state: "rejected", reason: "smtp-auth-failed" };
      return new Promise<EmailOutcome>((resolve) => {
        const connection = new SMTPConnection({ host: "smtp.qq.com", port: 465, secure: true,
          tls: { minVersion: "TLSv1.2", rejectUnauthorized: true, servername: "smtp.qq.com" },
          name: "observer.invalid", dnsTimeout: 30_000, connectionTimeout: 120_000,
          greetingTimeout: 300_000, socketTimeout: 600_000, logger: false, debug: false });
        let submitted = false, finished = false;
        const finish = (outcome: EmailOutcome) => {
          if (finished) return;
          finished = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); active.delete(abort);
          const socket = connection._socket;
          connection.close(); if (socket) socket.destroy(); resolve(outcome);
        };
        const abort = () => finish({ state: submitted ? "unknown" : "retryable", reason: "smtp-interrupted" });
        const timer = setTimeout(() => finish({ state: submitted ? "unknown" : "retryable", reason: "smtp-deadline" }), emailBudgets.transportTimeoutMs);
        active.add(abort); signal?.addEventListener("abort", abort, { once: true });
        const fail = (error: Error & { responseCode?: number | undefined; command?: string | undefined; code?: string | undefined }) => {
          const code = error.responseCode;
          // An explicit negative SMTP reply establishes non-acceptance. A lost
          // connection once send() starts does not establish whether DATA committed.
          if (code && code >= 400 && code <= 599 && /^(?:CONN|EHLO|HELO|AUTH(?: .*)?|MAIL FROM|RCPT TO|DATA)$/.test(error.command ?? ""))
            finish({ state: code < 500 ? "retryable" : "rejected", reason: code < 500 ? "smtp-temporary-rejection" : "smtp-rejected", responseCode: code });
          else finish({ state: submitted ? "unknown" : error.code === "EAUTH" ? "rejected" : "retryable",
            reason: submitted ? "smtp-response-unconfirmed" : error.code === "EAUTH" ? "smtp-auth-failed" : "smtp-before-submit-failed" });
        };
        connection.on("error", fail);
        connection.on("end", () => { if (!finished) finish({ state: submitted ? "unknown" : "retryable", reason: "smtp-response-unconfirmed" }); });
        connection.connect((error) => {
          if (finished) return;
          if (error) { fail(error); return; }
          if (!connection.secureConnection) { finish({ state: "rejected", reason: "smtp-before-submit-failed" }); return; }
          connection.login({ credentials: { user: checked.address, pass: key } }, (error) => {
            if (finished) return;
            if (error) { fail(error); return; }
            submitted = true;
            connection.send({ from: message.from, to: [message.to], size: message.raw.length }, message.raw, (error, info) => {
              if (finished) return;
              if (error) { fail(error); return; }
              const responseCode = Number(info?.response?.slice(0, 3));
              finish(info?.accepted?.includes(message.to) && responseCode === 250 ?
                { state: "accepted", reason: "smtp-accepted", responseCode } : { state: "unknown", reason: "smtp-response-unconfirmed" });
            });
          });
        });
        if (signal?.aborted) abort();
      });
    },
    close() { closed = true; for (const abort of active) abort(); },
  };
}
