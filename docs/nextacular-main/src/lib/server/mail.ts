import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export const emailConfig: SMTPTransport.Options = {
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  service: process.env.EMAIL_SERVICE,
};

const transporter = nodemailer.createTransport(emailConfig);

export type SendMailInput = {
  from?: string;
  html: string;
  subject: string;
  text: string;
  to: string | string[];
};

export const sendMail = async ({
  from,
  html,
  subject,
  text,
  to,
}: SendMailInput): Promise<void> => {
  const data = {
    from: from ?? process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  };

  if (process.env.NODE_ENV === 'production') {
    await transporter.sendMail(data);
  } else {
    // eslint-disable-next-line no-console
    console.log(data);
  }
};

export default transporter;
