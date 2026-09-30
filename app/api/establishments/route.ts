import { NextResponse } from "next/server";

import { getPublicError } from "@/lib/external-api/errors";
import { listEstablishments } from "@/lib/external-api/service";

export async function GET() {
  try {
    const data = await listEstablishments();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const result = getPublicError(error);
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.status },
    );
  }
}
