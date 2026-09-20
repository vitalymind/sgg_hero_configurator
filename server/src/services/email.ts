export interface EmailService {
	sendOtp(to: string, otp: string, context?: { name?: string | undefined }): Promise<void>;
}

/**
 * Development & Local Testing Email Service.
 * Prints formatted OTP verification to the server console/logs.
 */
export class ConsoleEmailService implements EmailService {
	async sendOtp(to: string, otp: string, context?: { name?: string | undefined }): Promise<void> {
		console.log(`[DEV EMAIL] To: ${to}`);
		console.log(`${context?.name ? `Hello ${context.name},` : 'Hello,'}`);
		console.log(`OTP is: ${otp}`);
	}
}

/**
 * Production Email Service Stub.
 * Ready for wiring with real production delivery providers (Resend, AWS SES, SendGrid, SMTP).
 */
export class ProductionEmailService implements EmailService {
	async sendOtp(to: string, otp: string, context?: { name?: string | undefined }): Promise<void> {
		// TODO: Configure your production email provider here.
		// Example with Resend (https://resend.com):
		//   import { Resend } from 'resend';
		//   const resend = new Resend(process.env.RESEND_API_KEY);
		//   await resend.emails.send({
		//       from: process.env.EMAIL_FROM || 'noreply@yourcompany.com',
		//       to,
		//       subject: `Your Login Code: ${otp}`,
		//       html: `<p>Hello${context?.name ? ' ' + context.name : ''},</p>`
		//           + `<p>Your verification code is: <strong>${otp}</strong></p>`
		//           + `<p>This code expires in 5 minutes.</p>`
		//   });
		//
		// Example with Nodemailer / SMTP:
		//   import nodemailer from 'nodemailer';
		//   const transporter = nodemailer.createTransport({ ... });
		//   await transporter.sendMail({ from, to, subject, html });

		console.warn(`[AUTH]: ProductionEmailService invoked for ${to}, but provider is not yet configured.`);
		throw new Error(
			'Production email provider is not yet configured. Please configure an email delivery service (e.g. Resend, SES).'
		);
	}
}

export function createEmailService(): EmailService {
	// If explicitly set to production and an email provider key/name is present, use ProductionEmailService
	if (process.env.NODE_ENV === 'production' && process.env.EMAIL_PROVIDER) {
		return new ProductionEmailService();
	}
	return new ConsoleEmailService();
}
