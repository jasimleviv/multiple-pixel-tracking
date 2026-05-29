import type { NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getCsvRows } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  const stringValue = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getCsvRows({
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
  });

  const header = ["opened_at", "tracking_id", "campaign", "email", "label", "ip_address", "user_agent", "is_unique"];
  const body = rows.map((row) =>
    [
      row.openedAt,
      row.trackingId,
      row.campaignName,
      row.email,
      row.label,
      row.ipAddress,
      row.userAgent,
      row.isUnique,
    ]
      .map(escapeCsv)
      .join(","),
  );

  return new Response([header.join(","), ...body].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="email-open-events.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
