import "server-only";

/**
 * One POST to Resend. No SDK: this is a single endpoint with a JSON body, and a
 * client library here would be tens of kilobytes to avoid nine lines.
 *
 * ponytail: no retry and no queue. A failed send logs and returns false — the
 * receipt link on the order page is the source of truth and the email is a
 * convenience. If sends ever start mattering, put them behind Vercel Queues.
 */
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
