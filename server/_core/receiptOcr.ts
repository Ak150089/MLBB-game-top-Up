import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ReceiptData {
  amount: number | null;        // Ks amount
  recipient: string | null;     // phone number
  transactionId: string | null; // TXN/reference ID
  date: string | null;          // date string
  paymentMethod: string | null; // kbzpay/wavepay/ayapay
  confidence: "high" | "medium" | "low";
  raw: string;
}

export async function extractReceiptData(imageUrl: string): Promise<ReceiptData> {
  // Fetch image as base64
  const imgRes = await fetch(imageUrl);
  const buffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType as any, data: base64 }
        },
        {
          type: "text",
          text: `This is a Myanmar mobile payment receipt (KBZ Pay / Wave Pay / AYA Pay).
Extract the following information and respond ONLY with valid JSON:
{
  "amount": <number in Ks, e.g. 7600, or null if not found>,
  "recipient": <phone number of recipient e.g. "09791890162", or null>,
  "transactionId": <transaction/reference ID string, or null>,
  "date": <date string e.g. "2026-07-01", or null>,
  "paymentMethod": <"kbzpay" or "wavepay" or "ayapay" or null>,
  "confidence": <"high" if all fields found, "medium" if some missing, "low" if unclear>,
  "isFake": <true if receipt looks edited/fake, false if genuine>
}`
        }
      ]
    }]
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      amount: parsed.amount ?? null,
      recipient: parsed.recipient ?? null,
      transactionId: parsed.transactionId ?? null,
      date: parsed.date ?? null,
      paymentMethod: parsed.paymentMethod ?? null,
      confidence: parsed.confidence ?? "low",
      raw: text,
    };
  } catch {
    return { amount: null, recipient: null, transactionId: null, date: null, paymentMethod: null, confidence: "low", raw: text };
  }
}

export interface VerifyResult {
  verified: boolean;
  reason: string;
  receiptData?: ReceiptData;
  isFakeDetected?: boolean;
}

export async function verifyReceipt(
  imageUrl: string,
  expectedAmountKs: number,
  ourPhoneNumbers: string[],
): Promise<VerifyResult> {
  const data = await extractReceiptData(imageUrl);

  // Fake detection
  if ((data as any).isFake === true) {
    return { verified: false, reason: "Receipt ကို edited/fake ဖြစ်နိုင်တယ်", receiptData: data, isFakeDetected: true };
  }

  // Low confidence
  if (data.confidence === "low") {
    return { verified: false, reason: "Receipt ကို ဖတ်မရပါ — ပြန်တင်ပါ", receiptData: data };
  }

  // Amount check (5% tolerance)
  if (data.amount === null) {
    return { verified: false, reason: "Amount မဖတ်ရပါ", receiptData: data };
  }
  const tolerance = expectedAmountKs * 0.05;
  if (Math.abs(data.amount - expectedAmountKs) > tolerance) {
    return {
      verified: false,
      reason: `Amount မကိုက် (receipt: ${data.amount.toLocaleString()} Ks, expected: ${expectedAmountKs.toLocaleString()} Ks)`,
      receiptData: data
    };
  }

  // Recipient check
  if (data.recipient === null) {
    return { verified: false, reason: "Recipient phone number မဖတ်ရပါ", receiptData: data };
  }
  const cleanRecipient = data.recipient.replace(/[^0-9]/g, "");
  const isOurs = ourPhoneNumbers.some(p => p.replace(/[^0-9]/g, "") === cleanRecipient);
  if (!isOurs) {
    return { verified: false, reason: `Recipient (${data.recipient}) မမှန်ကန်ပါ`, receiptData: data };
  }

  // Date check (within 48 hours)
  if (data.date) {
    const receiptDate = new Date(data.date);
    const now = new Date();
    const diffHours = (now.getTime() - receiptDate.getTime()) / 3600000;
    if (diffHours > 48) {
      return { verified: false, reason: "Receipt သည် 48 နာရီထက် ကျော်ပြီ", receiptData: data };
    }
  }

  return { verified: true, reason: "Receipt မှန်ကန်ပါသည်", receiptData: data };
}
