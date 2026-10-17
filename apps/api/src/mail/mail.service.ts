import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/config';

/**
 * Versand über konfigurierbares SMTP. Ohne SMTP_HOST ist der Versand
 * deaktiviert; in der Entwicklung können Links optional geloggt werden
 * (MAIL_LOG_LINKS=true – niemals in Produktion aktivieren).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: Transporter | null = null;

  constructor() {
    const c = config();
    if (c.mailEnabled) {
      this.transporter = nodemailer.createTransport({
        host: c.SMTP_HOST,
        port: c.SMTP_PORT,
        secure: c.SMTP_SECURE,
        auth: c.SMTP_USER ? { user: c.SMTP_USER, pass: c.SMTP_PASSWORD } : undefined,
      });
    }
  }

  get enabled() {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, text: string, html: string, debugLink?: string): Promise<boolean> {
    const c = config();
    if (!this.transporter) {
      if (c.MAIL_LOG_LINKS && c.NODE_ENV !== 'production' && debugLink) {
        this.logger.warn(`SMTP nicht konfiguriert – Link für "${subject}": ${debugLink}`);
      }
      return false;
    }
    try {
      await this.transporter.sendMail({ from: c.MAIL_FROM, to, subject, text, html });
      return true;
    } catch (e) {
      this.logger.error(`Versand fehlgeschlagen: ${(e as Error).message}`);
      return false;
    }
  }

  async sendVerification(to: string, link: string) {
    return this.send(
      to,
      'SATZIO – Bitte bestätige deine E-Mail-Adresse',
      `Willkommen bei SATZIO!\n\nBitte bestätige deine E-Mail-Adresse:\n${link}\n\nDer Link ist 48 Stunden gültig. Falls du dich nicht registriert hast, ignoriere diese E-Mail.`,
      layout(
        'E-Mail-Adresse bestätigen',
        `<p>Willkommen bei SATZIO! Bitte bestätige deine E-Mail-Adresse.</p>${button(link, 'E-Mail bestätigen')}<p style="color:#9BA6A0">Der Link ist 48 Stunden gültig. Falls du dich nicht registriert hast, ignoriere diese E-Mail.</p>`,
      ),
      link,
    );
  }

  async sendPasswordReset(to: string, link: string) {
    return this.send(
      to,
      'SATZIO – Passwort zurücksetzen',
      `Du hast angefordert, dein Passwort zurückzusetzen:\n${link}\n\nDer Link ist 60 Minuten gültig und kann nur einmal verwendet werden. Falls du das nicht warst, ignoriere diese E-Mail.`,
      layout(
        'Passwort zurücksetzen',
        `<p>Du hast angefordert, dein Passwort zurückzusetzen.</p>${button(link, 'Neues Passwort festlegen')}<p style="color:#9BA6A0">Der Link ist 60 Minuten gültig und kann nur einmal verwendet werden. Falls du das nicht warst, ignoriere diese E-Mail.</p>`,
      ),
      link,
    );
  }
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#B7FF3C;color:#0B0F0E;padding:12px 20px;border-radius:12px;font-weight:700;text-decoration:none">${label}</a></p>`;
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#0B0F0E;color:#F5F7F5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif"><div style="max-width:520px;margin:0 auto;padding:32px 24px"><div style="font-weight:800;letter-spacing:.12em;color:#B7FF3C">SATZIO</div><h1 style="font-size:22px">${title}</h1>${body}</div></body></html>`;
}
