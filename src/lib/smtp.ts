import { Socket } from "node:net";
import { TLSSocket, connect } from "node:tls";

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

async function readResponse(socket: TLSSocket): Promise<{ code: number; lines: string[] }> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || last.length < 4) return;

      const code = Number(last.slice(0, 3));
      const separator = last[3];
      if (Number.isNaN(code) || separator === "-") {
        return;
      }

      socket.off("data", onData);
      resolve({ code, lines });
    };

    const onError = (error: Error) => {
      socket.off("data", onData);
      reject(error);
    };

    socket.on("data", onData);
    socket.once("error", onError);
  });
}

async function sendCommand(socket: TLSSocket, command: string, expectedCodes: number[]) {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${command}): ${response.lines.join(" | ")}`);
  }
  return response;
}

export async function sendInviteEmail(params: {
  to: string;
  recipientName?: string;
  inviteUrl: string;
  role: "admin" | "user";
}) {
  const from = "ahawkhoque@gmail.com";
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!appPassword) {
    throw new Error("Missing GMAIL_APP_PASSWORD env var");
  }

  const socket = connect({ host: "smtp.gmail.com", port: 465, servername: "smtp.gmail.com" });

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", (error) => reject(error));
    socket.setTimeout(15000, () => reject(new Error("SMTP connection timed out")));
  });

  try {
    const greeting = await readResponse(socket);
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting failed: ${greeting.lines.join(" | ")}`);
    }

    await sendCommand(socket, "EHLO kanbanflow.local", [250]);
    await sendCommand(socket, "AUTH LOGIN", [334]);
    await sendCommand(socket, encodeBase64(from), [334]);
    await sendCommand(socket, encodeBase64(appPassword), [235]);
    await sendCommand(socket, `MAIL FROM:<${from}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${params.to}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);

    const safeName = sanitizeHeader(params.recipientName || "there");
    const safeRole = sanitizeHeader(params.role);
    const safeTo = sanitizeHeader(params.to);

    const subject = "KanbanFlow Invitation";
    const textBody = [
      `Hi ${safeName},`,
      "",
      `You have been invited to KanbanFlow as a ${safeRole}.`,
      `Complete registration here: ${params.inviteUrl}`,
      "",
      "If you did not expect this invite, you can ignore this email.",
    ].join("\n");

    const mime = [
      `From: KanbanFlow <${from}>`,
      `To: <${safeTo}>`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      textBody,
      ".",
    ].join("\r\n");

    socket.write(`${mime}\r\n`);
    const sent = await readResponse(socket);
    if (sent.code !== 250) {
      throw new Error(`SMTP data send failed: ${sent.lines.join(" | ")}`);
    }

    await sendCommand(socket, "QUIT", [221]);
  } finally {
    if (!socket.destroyed) {
      socket.end();
    }
  }
}
