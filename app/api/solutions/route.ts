import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const solution = await request.json();
  // POC-only endpoint. Replace with an authenticated Firestore write.
  return NextResponse.json({ id: crypto.randomUUID(), savedAt: new Date().toISOString(), solution }, { status: 201 });
}
