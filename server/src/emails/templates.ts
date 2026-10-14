import { env } from '@/config/env';
import type { Mail } from '@/lib/mailer';

/**
 * Plain, table-based HTML emails that render in every client. One layout:
 * indigo band, a stitched rule, the message, one action.
 */

const C = {
  indigo: '#1E2756',
  ink: '#141A33',
  muted: '#545B78',
  line: '#E3E6F0',
  ground: '#F6F7FB',
  marigold: '#F2B33D',
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface LayoutInput {
  preheader: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}

function layout({ preheader, heading, paragraphs, action, footnote }: LayoutInput) {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.ink}">${p}</p>`)
    .join('');
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${C.indigo};border-radius:10px">
        <a href="${action.url}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:600;color:#fff;text-decoration:none">${esc(action.label)}</a>
      </td></tr></table>
      <p style="margin:0 0 16px;font-size:13px;color:${C.muted};word-break:break-all">Or paste this link into your browser:<br>${action.url}</p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:${C.ground};font-family:Segoe UI,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ground};padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid ${C.line};border-radius:14px;overflow:hidden">
<tr><td style="background:${C.indigo};padding:22px 28px;color:#fff;font-size:18px;font-weight:700">Hajira</td></tr>
<tr><td style="padding:0 28px"><div style="height:2px;margin:0;background:repeating-linear-gradient(90deg,${C.marigold} 0 8px,transparent 8px 14px)"></div></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${C.ink}">${esc(heading)}</h1>
${body}${button}
${footnote ? `<p style="margin:0;font-size:13px;color:${C.muted}">${footnote}</p>` : ''}
</td></tr></table>
<p style="font-size:12px;color:${C.muted};margin:16px 0 0">Hajira attendance &amp; leave · this is an automated message</p>
</td></tr></table></body></html>`;
}

function text({ heading, paragraphs, action, footnote }: LayoutInput) {
  const strip = (s: string) => s.replace(/<[^>]+>/g, '');
  return [heading, '', ...paragraphs.map(strip), action ? `\n${action.label}: ${action.url}` : '', footnote ? `\n${strip(footnote)}` : '']
    .join('\n')
    .trim();
}

function mail(to: string, subject: string, input: LayoutInput): Mail {
  return { to, subject, html: layout(input), text: text(input) };
}

const link = (path: string) => `${env.APP_URL}${path}`;

export const emails = {
  verifyEmail: (to: string, name: string, token: string) =>
    mail(to, 'Confirm your email for Hajira', {
      preheader: 'Confirm your email address to finish registering.',
      heading: `Confirm your email, ${name.split(' ')[0]}`,
      paragraphs: [
        'Thanks for registering. Confirm this is your email address so HR can approve your account.',
      ],
      action: { label: 'Confirm email', url: link(`/verify-email?token=${token}`) },
      footnote: 'This link expires in 24 hours. If you did not register, you can ignore this email.',
    }),

  resetPassword: (to: string, name: string, token: string) =>
    mail(to, 'Reset your Hajira password', {
      preheader: 'A password reset was requested for your account.',
      heading: 'Reset your password',
      paragraphs: [`Hi ${esc(name.split(' ')[0])}, someone (hopefully you) asked to reset your password.`],
      action: { label: 'Choose a new password', url: link(`/reset-password?token=${token}`) },
      footnote: 'This link expires in 15 minutes and can be used once. If you did not ask for it, ignore this email; your password stays the same.',
    }),

  invite: (to: string, name: string, inviter: string, token: string) =>
    mail(to, `${inviter} invited you to Hajira`, {
      preheader: 'Set a password to start checking in.',
      heading: `Welcome aboard, ${name.split(' ')[0]}`,
      paragraphs: [
        `${esc(inviter)} added you to Hajira, where you check in, apply for leave and see your attendance.`,
        'Set a password to activate your account.',
      ],
      action: { label: 'Set my password', url: link(`/accept-invite?token=${token}`) },
      footnote: 'This invitation expires in 7 days.',
    }),

  accountApproved: (to: string, name: string) =>
    mail(to, 'Your Hajira account is approved', {
      preheader: 'You can sign in now.',
      heading: 'You are all set',
      paragraphs: [`Hi ${esc(name.split(' ')[0])}, HR approved your account. You can sign in and check in from today.`],
      action: { label: 'Sign in', url: link('/login') },
    }),

  accountRejected: (to: string, name: string, reason: string) =>
    mail(to, 'About your Hajira registration', {
      preheader: 'Your registration was not approved.',
      heading: 'Registration not approved',
      paragraphs: [
        `Hi ${esc(name.split(' ')[0])}, HR could not approve your registration.`,
        `Reason: ${esc(reason)}`,
        'If you think this is a mistake, contact your HR team.',
      ],
    }),

  leaveStatus: (to: string, name: string, summary: string, status: string, comment?: string | null) =>
    mail(to, `Leave ${status.toLowerCase()}: ${summary}`, {
      preheader: `Your leave request was ${status.toLowerCase()}.`,
      heading: `Leave ${status.toLowerCase()}`,
      paragraphs: [
        `Hi ${esc(name.split(' ')[0])}, your request for <strong>${esc(summary)}</strong> was ${status.toLowerCase()}.`,
        ...(comment ? [`Comment: “${esc(comment)}”`] : []),
      ],
      action: { label: 'View my leave', url: link('/leave') },
    }),

  leaveRequest: (to: string, approver: string, requester: string, summary: string) =>
    mail(to, `${requester} requested leave`, {
      preheader: `${requester} is waiting for your decision.`,
      heading: 'A leave request needs you',
      paragraphs: [`Hi ${esc(approver.split(' ')[0])}, ${esc(requester)} requested <strong>${esc(summary)}</strong>.`],
      action: { label: 'Review request', url: link('/approvals') },
    }),

  lateWarning: (to: string, name: string, time: string, lateMinutes: number, count: number, threshold: number | null) =>
    mail(to, `Late check-in recorded at ${time}`, {
      preheader: `${lateMinutes} minutes late.`,
      heading: 'Late check-in recorded',
      paragraphs: [
        `Hi ${esc(name.split(' ')[0])}, you checked in at <strong>${time}</strong>, ${lateMinutes} minutes after your shift started.`,
        threshold
          ? `That is late mark ${count} this month. Every ${threshold} late marks deduct one day of leave.`
          : `That is late mark ${count} this month.`,
        'If this is wrong, request a regularization from your attendance page.',
      ],
      action: { label: 'Open my attendance', url: link('/attendance') },
    }),

  missingCheckout: (to: string, name: string, date: string, closedAt: string) =>
    mail(to, `You did not check out on ${date}`, {
      preheader: 'Your day was closed automatically.',
      heading: 'Missing check-out',
      paragraphs: [
        `Hi ${esc(name.split(' ')[0])}, there was no check-out on <strong>${esc(date)}</strong>, so the day was closed at ${closedAt} and flagged for review.`,
        'If you worked different hours, request a regularization with the correct time.',
      ],
      action: { label: 'Request a correction', url: link('/attendance?regularize=1') },
    }),

  regularizationStatus: (to: string, name: string, date: string, status: string, comment?: string | null) =>
    mail(to, `Attendance correction ${status.toLowerCase()}`, {
      preheader: `Your correction for ${date} was ${status.toLowerCase()}.`,
      heading: `Correction ${status.toLowerCase()}`,
      paragraphs: [
        `Hi ${esc(name.split(' ')[0])}, your attendance correction for <strong>${esc(date)}</strong> was ${status.toLowerCase()}.`,
        ...(comment ? [`Comment: “${esc(comment)}”`] : []),
      ],
      action: { label: 'View attendance', url: link('/attendance') },
    }),

  latePenalty: (to: string, name: string, month: string, lateCount: number, days: number, leaveType: string) =>
    mail(to, `Late policy: ${days} ${leaveType} day${days === 1 ? '' : 's'} deducted`, {
      preheader: `${lateCount} late marks in ${month}.`,
      heading: 'Late policy applied',
      paragraphs: [
        `Hi ${esc(name.split(' ')[0])}, you had ${lateCount} late marks in ${esc(month)}.`,
        `Under the company late policy, ${days} day${days === 1 ? '' : 's'} of ${esc(leaveType)} ${days === 1 ? 'was' : 'were'} deducted from your balance.`,
      ],
      action: { label: 'View balances', url: link('/leave') },
    }),
};
