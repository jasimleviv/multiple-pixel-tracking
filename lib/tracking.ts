import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, isDatabaseConfigured } from "@/lib/db";
import { campaigns, openEvents, recipients, uniqueOpens } from "@/lib/db/schema";
import {
  localCampaigns,
  localCreateCampaign,
  localCsvRows,
  localDashboardData,
  localRecipients,
  localRecordOpen,
} from "@/lib/local-store";
import { getBaseUrl, trackingPixelHtml } from "@/lib/utils";

export const campaignSchema = z.object({
  name: z.string().trim().min(2, "Campaign name is required").max(160),
  description: z.string().trim().max(2000).optional(),
  recipients: z.string().trim().max(20_000).optional(),
});

export type DateRange = {
  from?: string;
  to?: string;
  q?: string;
  page?: number;
};

function randomId(bytes = 9) {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .toString("base64url")
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function parseRecipientLines(input?: string) {
  const lines = input
    ?.split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines?.length) {
    return [{ email: null, label: "Default pixel" }];
  }

  return lines.slice(0, 500).map((line, index) => {
    const emailMatch = line.match(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/);
    return {
      email: emailMatch?.[0]?.toLowerCase() ?? null,
      label: emailMatch ? line.replace(emailMatch[0], "").trim() || null : line || `Pixel ${index + 1}`,
    };
  });
}

export function pixelUrl(trackingId: string) {
  return `${getBaseUrl()}/api/open?id=${encodeURIComponent(trackingId)}`;
}

export async function createCampaign(formData: FormData) {
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    recipients: formData.get("recipients"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid campaign" };
  }

  const slug = randomId(8);
  const recipientRows = parseRecipientLines(parsed.data.recipients);

  if (!isDatabaseConfigured()) {
    await localCreateCampaign({
      name: parsed.data.name,
      description: parsed.data.description,
      slug,
      recipients: recipientRows.map((recipient, index) => ({
        email: recipient.email,
        label: recipient.label || `Pixel ${index + 1}`,
        trackingId: `${slug}_${randomId(10)}`,
      })),
    });

    return { ok: true, message: "Campaign created locally" };
  }

  const insertedCampaign = await db
    .insert(campaigns)
    .values({
      name: parsed.data.name,
      description: parsed.data.description || null,
      slug,
    })
    .returning();

  const campaign = insertedCampaign[0];

  await db.insert(recipients).values(
    recipientRows.map((recipient, index) => ({
      campaignId: campaign.id,
      email: recipient.email,
      label: recipient.label || `Pixel ${index + 1}`,
      trackingId: `${slug}_${randomId(10)}`,
    })),
  );

  return { ok: true, message: "Campaign created" };
}

export async function recordOpen(input: {
  trackingId: string;
  ipAddress: string;
  userAgent: string | null;
  country?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    await localRecordOpen(input);
    return;
  }

  const trackingId = input.trackingId.trim();

  if (!/^[a-zA-Z0-9_-]{6,96}$/.test(trackingId)) {
    return;
  }

  const [recipient] = await db
    .select({
      id: recipients.id,
      campaignId: recipients.campaignId,
    })
    .from(recipients)
    .where(eq(recipients.trackingId, trackingId))
    .limit(1);

  if (!recipient) {
    await db.insert(openEvents).values({
      trackingId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      country: input.country ?? null,
      isUnique: false,
    });
    return;
  }

  const insertedUnique = await db
    .insert(uniqueOpens)
    .values({
      trackingId,
      recipientId: recipient.id,
      campaignId: recipient.campaignId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
    .onConflictDoNothing({
      target: [uniqueOpens.trackingId, uniqueOpens.ipAddress],
    })
    .returning({ id: uniqueOpens.id });

  await db.insert(openEvents).values({
    trackingId,
    recipientId: recipient.id,
    campaignId: recipient.campaignId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    country: input.country ?? null,
    isUnique: insertedUnique.length > 0,
  });
}

function dateFilters(range: DateRange) {
  const filters = [];

  if (range.from) {
    filters.push(gte(openEvents.openedAt, new Date(`${range.from}T00:00:00.000Z`)));
  }

  if (range.to) {
    filters.push(lte(openEvents.openedAt, new Date(`${range.to}T23:59:59.999Z`)));
  }

  return filters;
}

export async function getDashboardData(range: DateRange = {}) {
  if (!isDatabaseConfigured()) {
    return localDashboardData(range);
  }

  const filters = dateFilters(range);
  const where = filters.length ? and(...filters) : undefined;

  const [totals] = await db
    .select({
      totalOpens: sql<number>`count(*)::int`,
      uniqueOpens: sql<number>`count(*) filter (where ${openEvents.isUnique} = true)::int`,
    })
    .from(openEvents)
    .where(where);

  const [recipientCount] = await db.select({ count: sql<number>`count(*)::int` }).from(recipients);

  const latestOpens = await db
    .select({
      id: openEvents.id,
      openedAt: openEvents.openedAt,
      ipAddress: openEvents.ipAddress,
      userAgent: openEvents.userAgent,
      isUnique: openEvents.isUnique,
      campaignName: campaigns.name,
      email: recipients.email,
      label: recipients.label,
    })
    .from(openEvents)
    .leftJoin(campaigns, eq(openEvents.campaignId, campaigns.id))
    .leftJoin(recipients, eq(openEvents.recipientId, recipients.id))
    .where(where)
    .orderBy(desc(openEvents.openedAt))
    .limit(12);

  const opensByDay = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${openEvents.openedAt}), 'YYYY-MM-DD')`,
      opens: sql<number>`count(*)::int`,
      unique: sql<number>`count(*) filter (where ${openEvents.isUnique} = true)::int`,
    })
    .from(openEvents)
    .where(where)
    .groupBy(sql`date_trunc('day', ${openEvents.openedAt})`)
    .orderBy(sql`date_trunc('day', ${openEvents.openedAt})`);

  const topUserAgents = await db
    .select({
      userAgent: sql<string>`coalesce(${openEvents.userAgent}, 'Unknown')`,
      opens: sql<number>`count(*)::int`,
    })
    .from(openEvents)
    .where(where)
    .groupBy(sql`coalesce(${openEvents.userAgent}, 'Unknown')`)
    .orderBy(sql`count(*) desc`)
    .limit(6);

  const duplicateOpens = (totals?.totalOpens ?? 0) - (totals?.uniqueOpens ?? 0);
  const openRate = recipientCount.count ? ((totals?.uniqueOpens ?? 0) / recipientCount.count) * 100 : 0;

  return {
    totalOpens: totals?.totalOpens ?? 0,
    uniqueOpens: totals?.uniqueOpens ?? 0,
    duplicateOpens,
    openRate,
    recipientCount: recipientCount.count,
    latestOpens,
    opensByDay,
    topUserAgents,
  };
}

export async function getCampaigns() {
  if (!isDatabaseConfigured()) {
    return localCampaigns();
  }

  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      createdAt: campaigns.createdAt,
      recipients: sql<number>`count(distinct ${recipients.id})::int`,
      totalOpens: sql<number>`count(${openEvents.id})::int`,
      uniqueOpens: sql<number>`count(${openEvents.id}) filter (where ${openEvents.isUnique} = true)::int`,
    })
    .from(campaigns)
    .leftJoin(recipients, eq(recipients.campaignId, campaigns.id))
    .leftJoin(openEvents, eq(openEvents.campaignId, campaigns.id))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt))
    .limit(12);
}

export async function getRecipients(range: DateRange = {}) {
  if (!isDatabaseConfigured()) {
    return localRecipients(range);
  }

  const page = Math.max(1, range.page ?? 1);
  const pageSize = 10;
  const searchFilter = range.q
    ? ilike(sql<string>`coalesce(${recipients.email}, ${recipients.label}, ${recipients.trackingId})`, `%${range.q}%`)
    : undefined;

  const rows = await db
    .select({
      id: recipients.id,
      email: recipients.email,
      label: recipients.label,
      trackingId: recipients.trackingId,
      campaignName: campaigns.name,
      createdAt: recipients.createdAt,
      totalOpens: sql<number>`count(${openEvents.id})::int`,
      uniqueOpens: sql<number>`count(${openEvents.id}) filter (where ${openEvents.isUnique} = true)::int`,
    })
    .from(recipients)
    .leftJoin(campaigns, eq(recipients.campaignId, campaigns.id))
    .leftJoin(openEvents, eq(recipients.trackingId, openEvents.trackingId))
    .where(searchFilter)
    .groupBy(recipients.id, campaigns.name)
    .orderBy(desc(recipients.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipients)
    .where(searchFilter);

  return {
    rows: rows.map((row) => ({
      ...row,
      pixelUrl: pixelUrl(row.trackingId),
      pixelHtml: trackingPixelHtml(pixelUrl(row.trackingId)),
    })),
    page,
    pageSize,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
  };
}

export async function getCsvRows(range: DateRange = {}) {
  if (!isDatabaseConfigured()) {
    return localCsvRows(range);
  }

  return db
    .select({
      openedAt: openEvents.openedAt,
      trackingId: openEvents.trackingId,
      campaignName: campaigns.name,
      email: recipients.email,
      label: recipients.label,
      ipAddress: openEvents.ipAddress,
      userAgent: openEvents.userAgent,
      isUnique: openEvents.isUnique,
    })
    .from(openEvents)
    .leftJoin(campaigns, eq(openEvents.campaignId, campaigns.id))
    .leftJoin(recipients, eq(openEvents.recipientId, recipients.id))
    .where(dateFilters(range).length ? and(...dateFilters(range)) : undefined)
    .orderBy(desc(openEvents.openedAt))
    .limit(5000);
}
