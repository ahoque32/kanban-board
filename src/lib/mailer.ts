import nodemailer from "nodemailer";

function buildTransport() {
  const from = "ahawkhoque@gmail.com";
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) {
    throw new Error("GMAIL_APP_PASSWORD is not configured");
  }

  return {
    transporter: nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: from,
        pass,
      },
    }),
    from,
  };
}

export async function sendInviteEmail(email: string, invitedBy: string) {
  const { transporter, from } = buildTransport();
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const registerLink = `${appUrl}/register?email=${encodeURIComponent(email)}`;

  await transporter.sendMail({
    from,
    to: email,
    subject: "You are invited to KanbanFlow",
    text: `You have been invited by ${invitedBy} to KanbanFlow. Register here: ${registerLink}`,
    html: `<p>You have been invited by <strong>${invitedBy}</strong> to KanbanFlow.</p><p><a href=\"${registerLink}\">Create your account</a></p>`,
  });
}
