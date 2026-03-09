import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const email = (body.email || "").toString().trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: "GMAIL_APP_PASSWORD is not configured" }, { status: 500 });
  }

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const registerUrl = `${protocol}://${host}/register`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "ahawkhoque@gmail.com",
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: "ahawkhoque@gmail.com",
    to: email,
    subject: "KanbanFlow Invitation",
    text: `You've been invited to KanbanFlow. Register here: ${registerUrl}`,
    html: `<p>You've been invited to KanbanFlow.</p><p>Register here: <a href="${registerUrl}">${registerUrl}</a></p>`,
  });

  return NextResponse.json({ ok: true });
}
