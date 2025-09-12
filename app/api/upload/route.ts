import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 500 });
  }

  const blob = await put(file.name, file, {
    access: "public",
    token,
  });

  return NextResponse.json(blob);
}
