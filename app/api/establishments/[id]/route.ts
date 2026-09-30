import { NextResponse } from "next/server";

import { getPublicError } from "@/lib/external-api/errors";
import { getEstablishment } from "@/lib/external-api/service";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/establishments/[id]">,
) {
  try {
    const { id } = await context.params;
    const data = await getEstablishment(id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const result = getPublicError(error);
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.status },
    );
  }
}
