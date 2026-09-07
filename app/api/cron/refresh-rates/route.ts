import { NextResponse } from "next/server";
import { refreshExchangeRates } from "@/lib/currency/service";

// Configure in vercel.json as a scheduled cron hitting this path with the
// `Authorization: Bearer ${CRON_SECRET}` header (Vercel Cron sets this
// automatically when CRON_SECRET is set as a project env var).
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await refreshExchangeRates();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
