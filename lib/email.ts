import "server-only";

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY is not set — not sending", message.subject);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.RECEIPT_FROM ?? "KROMA <bar@kroma.coffee>",
        ...message,
      }),
    });
    if (!response.ok) console.error("email rejected:", response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error("email failed:", error);
    return false;
  }
}
