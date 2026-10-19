import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const secret = () => process.env.ADMIN_PASSWORD ?? "";

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export async function POST(request: Request) {
  if (!secret()) {
    return NextResponse.json({ ok: false, error: "ADMIN_PASSWORD is not set" }, { status: 503 });
  }

  let password = "";
  try {
    password = String((await request.json()).password ?? "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!safeEqual(password, secret())) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
