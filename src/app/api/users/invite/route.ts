import crypto from "crypto";
import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { inviteTokens } from "@/lib/schema";

const SENDER_EMAIL = process.env.INVITE_FROM_EMAIL || "admin@renderwise.net";

export async function POST(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const email = (body.email || "").toString().trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Generate a single-use invite token
  const token = crypto.randomBytes(32).toString("hex");
  db.insert(inviteTokens).values({ token, email }).run();

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const registerUrl = `${protocol}://${host}/register?token=${token}`;

  // If email is configured, send invite email
  if (process.env.GMAIL_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: SENDER_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: SENDER_EMAIL,
      to: email,
      subject: "KanbanFlow Invitation",
      text: `You've been invited to KanbanFlow by ${auth.user.name}. Register here: ${registerUrl}`,
      html: `<p>You've been invited to <strong>KanbanFlow</strong> by ${auth.user.name}.</p><p><a href="${registerUrl}">Create your account</a></p>`,
    });

    return NextResponse.json({ ok: true, emailSent: true });
  }

  // No email configured — return the invite link for the UI to display
  return NextResponse.json({ ok: true, emailSent: false, registerUrl });
}
