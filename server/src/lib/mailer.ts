import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

let transporter: Transporter | null = null;
const devMode = !env.SMTP_HOST;

function getTransporter() {
  if (transporter) return transporter;
  transporter = devMode
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email without blocking the request. With no SMTP configured, the
 * email (including any action link) is printed to the server log instead.
 */
export function sendMail(mail: Mail) {
  void (async () => {
    try {
      await getTransporter().sendMail({ from: env.MAIL_FROM, ...mail });
      if (devMode) {
        logger.info(
          { to: mail.to, subject: mail.subject },
          `\n──── email (dev: SMTP not configured) ────\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n──────────────────────────────────────────`,
        );
      }
    } catch (err) {
      logger.error({ err, to: mail.to, subject: mail.subject }, 'Failed to send email');
    }
  })();
}
