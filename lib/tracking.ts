import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, isDatabaseConfigured } from "@/lib/db";
import { campaigns, clickEvents, openEvents, recipients, uniqueClicks, uniqueOpens } from "@/lib/db/schema";
import {
  localCampaigns,
  localCreateCampaign,
  localCsvRows,
  localDashboardData,
  localGetClickDestination,
  localRecipients,
  localRecordClick,
  localRecordOpen,
} from "@/lib/local-store";
import { getBaseUrl, trackingPixelHtml } from "@/lib/utils";

export const campaignSchema = z.object({
  name: z.string().trim().min(2, "Campaign name is required").max(160),
  description: z.string().trim().max(2000).optional(),
  clickUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.url("Use a valid click destination URL").optional()),
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

function newTrackingId() {
  return randomId(6);
}

export function isValidTrackingId(trackingId: string) {
  return /^[a-zA-Z0-9_-]{8}$/.test(trackingId);
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

export function clickUrl(trackingId: string) {
  return `${getBaseUrl()}/api/click?id=${encodeURIComponent(trackingId)}`;
}

export async function createCampaign(formData: FormData) {
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    clickUrl: formData.get("clickUrl"),
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
      clickUrl: parsed.data.clickUrl,
      slug,
      recipients: recipientRows.map((recipient, index) => ({
        email: recipient.email,
        label: recipient.label || `Pixel ${index + 1}`,
        trackingId: newTrackingId(),
      })),
    });

    return { ok: true, message: "Campaign created locally" };
  }

  const insertedCampaign = await db
    .insert(campaigns)
    .values({
      name: parsed.data.name,
      description: parsed.data.description || null,
      clickUrl: parsed.data.clickUrl || null,
      slug,
    })
    .returning();

  const campaign = insertedCampaign[0];

  await db.insert(recipients).values(
    recipientRows.map((recipient, index) => ({
      campaignId: campaign.id,
      email: recipient.email,
      label: recipient.label || `Pixel ${index + 1}`,
      trackingId: newTrackingId(),
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

  if (!isValidTrackingId(trackingId)) {
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

export async function recordClick(input: {
  trackingId: string;
  ipAddress: string;
  userAgent: string | null;
  country?: string | null;
}) {
  if (!isDatabaseConfigured()) {
    return localRecordClick(input);
  }

  const trackingId = input.trackingId.trim();

  if (!isValidTrackingId(trackingId)) {
    return getBaseUrl();
  }

  const [recipient] = await db
    .select({
      id: recipients.id,
      campaignId: recipients.campaignId,
      clickUrl: campaigns.clickUrl,
    })
    .from(recipients)
    .leftJoin(campaigns, eq(recipients.campaignId, campaigns.id))
    .where(eq(recipients.trackingId, trackingId))
    .limit(1);

  const destinationUrl = recipient?.clickUrl || getBaseUrl();

  if (!recipient) {
    await db.insert(clickEvents).values({
      trackingId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      country: input.country ?? null,
      destinationUrl,
      isUnique: false,
    });
    return destinationUrl;
  }

  const insertedUnique = await db
    .insert(uniqueClicks)
    .values({
      trackingId,
      recipientId: recipient.id,
      campaignId: recipient.campaignId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
    .onConflictDoNothing({
      target: [uniqueClicks.trackingId, uniqueClicks.ipAddress],
    })
    .returning({ id: uniqueClicks.id });

  await db.insert(clickEvents).values({
    trackingId,
    recipientId: recipient.id,
    campaignId: recipient.campaignId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    country: input.country ?? null,
    destinationUrl,
    isUnique: insertedUnique.length > 0,
  });

  return destinationUrl;
}

export async function getClickDestination(trackingId: string) {
  if (!isValidTrackingId(trackingId)) {
    return getBaseUrl();
  }

  if (!isDatabaseConfigured()) {
    return localGetClickDestination(trackingId);
  }

  const [row] = await db
    .select({ clickUrl: campaigns.clickUrl })
    .from(recipients)
    .leftJoin(campaigns, eq(recipients.campaignId, campaigns.id))
    .where(eq(recipients.trackingId, trackingId))
    .limit(1);

  return row?.clickUrl || getBaseUrl();
}

function dateFilters(range: DateRange, column: typeof openEvents.openedAt | typeof clickEvents.clickedAt) {
  const filters = [];

  if (range.from) {
    filters.push(gte(column, new Date(`${range.from}T00:00:00.000Z`)));
  }

  if (range.to) {
    filters.push(lte(column, new Date(`${range.to}T23:59:59.999Z`)));
  }

  return filters;
}

export async function getDashboardData(range: DateRange = {}) {
  if (!isDatabaseConfigured()) {
    return localDashboardData(range);
  }

  const openFilters = dateFilters(range, openEvents.openedAt);
  const clickFilters = dateFilters(range, clickEvents.clickedAt);
  const openWhere = openFilters.length ? and(...openFilters) : undefined;
  const clickWhere = clickFilters.length ? and(...clickFilters) : undefined;

  const [totals] = await db
    .select({
      totalOpens: sql<number>`count(*)::int`,
      uniqueOpens: sql<number>`count(*) filter (where ${openEvents.isUnique} = true)::int`,
    })
    .from(openEvents)
    .where(openWhere);

  const [clickTotals] = await db
    .select({
      totalClicks: sql<number>`count(*)::int`,
      uniqueClicks: sql<number>`count(*) filter (where ${clickEvents.isUnique} = true)::int`,
    })
    .from(clickEvents)
    .where(clickWhere);

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
    .where(openWhere)
    .orderBy(desc(openEvents.openedAt))
    .limit(12);

  const latestClicks = await db
    .select({
      id: clickEvents.id,
      clickedAt: clickEvents.clickedAt,
      ipAddress: clickEvents.ipAddress,
      userAgent: clickEvents.userAgent,
      destinationUrl: clickEvents.destinationUrl,
      isUnique: clickEvents.isUnique,
      campaignName: campaigns.name,
      email: recipients.email,
      label: recipients.label,
    })
    .from(clickEvents)
    .leftJoin(campaigns, eq(clickEvents.campaignId, campaigns.id))
    .leftJoin(recipients, eq(clickEvents.recipientId, recipients.id))
    .where(clickWhere)
    .orderBy(desc(clickEvents.clickedAt))
    .limit(12);

  const opensByDay = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${openEvents.openedAt}), 'YYYY-MM-DD')`,
      opens: sql<number>`count(*)::int`,
      unique: sql<number>`count(*) filter (where ${openEvents.isUnique} = true)::int`,
    })
    .from(openEvents)
    .where(openWhere)
    .groupBy(sql`date_trunc('day', ${openEvents.openedAt})`)
    .orderBy(sql`date_trunc('day', ${openEvents.openedAt})`);

  const topUserAgents = await db
    .select({
      userAgent: sql<string>`coalesce(${openEvents.userAgent}, 'Unknown')`,
      opens: sql<number>`count(*)::int`,
    })
    .from(openEvents)
    .where(openWhere)
    .groupBy(sql`coalesce(${openEvents.userAgent}, 'Unknown')`)
    .orderBy(sql`count(*) desc`)
    .limit(6);

  const duplicateOpens = (totals?.totalOpens ?? 0) - (totals?.uniqueOpens ?? 0);
  const duplicateClicks = (clickTotals?.totalClicks ?? 0) - (clickTotals?.uniqueClicks ?? 0);
  const openRate = recipientCount.count ? ((totals?.uniqueOpens ?? 0) / recipientCount.count) * 100 : 0;
  const clickRate = recipientCount.count ? ((clickTotals?.uniqueClicks ?? 0) / recipientCount.count) * 100 : 0;

  return {
    totalOpens: totals?.totalOpens ?? 0,
    uniqueOpens: totals?.uniqueOpens ?? 0,
    duplicateOpens,
    totalClicks: clickTotals?.totalClicks ?? 0,
    uniqueClicks: clickTotals?.uniqueClicks ?? 0,
    duplicateClicks,
    openRate,
    clickRate,
    recipientCount: recipientCount.count,
    latestOpens,
    latestClicks,
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
      totalOpens: sql<number>`count(distinct ${openEvents.id})::int`,
      uniqueOpens: sql<number>`count(distinct ${openEvents.id}) filter (where ${openEvents.isUnique} = true)::int`,
      totalClicks: sql<number>`count(distinct ${clickEvents.id})::int`,
      uniqueClicks: sql<number>`count(distinct ${clickEvents.id}) filter (where ${clickEvents.isUnique} = true)::int`,
    })
    .from(campaigns)
    .leftJoin(recipients, eq(recipients.campaignId, campaigns.id))
    .leftJoin(openEvents, eq(openEvents.campaignId, campaigns.id))
    .leftJoin(clickEvents, eq(clickEvents.campaignId, campaigns.id))
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
      totalOpens: sql<number>`count(distinct ${openEvents.id})::int`,
      uniqueOpens: sql<number>`count(distinct ${openEvents.id}) filter (where ${openEvents.isUnique} = true)::int`,
      totalClicks: sql<number>`count(distinct ${clickEvents.id})::int`,
      uniqueClicks: sql<number>`count(distinct ${clickEvents.id}) filter (where ${clickEvents.isUnique} = true)::int`,
    })
    .from(recipients)
    .leftJoin(campaigns, eq(recipients.campaignId, campaigns.id))
    .leftJoin(openEvents, eq(recipients.trackingId, openEvents.trackingId))
    .leftJoin(clickEvents, eq(recipients.trackingId, clickEvents.trackingId))
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
      clickUrl: clickUrl(row.trackingId),
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

  const openRows = await db
    .select({
      eventType: sql<string>`'open'`,
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
    .where(dateFilters(range, openEvents.openedAt).length ? and(...dateFilters(range, openEvents.openedAt)) : undefined)
    .orderBy(desc(openEvents.openedAt))
    .limit(5000);

  const clickRows = await db
    .select({
      eventType: sql<string>`'click'`,
      openedAt: clickEvents.clickedAt,
      trackingId: clickEvents.trackingId,
      campaignName: campaigns.name,
      email: recipients.email,
      label: recipients.label,
      ipAddress: clickEvents.ipAddress,
      userAgent: clickEvents.userAgent,
      isUnique: clickEvents.isUnique,
    })
    .from(clickEvents)
    .leftJoin(campaigns, eq(clickEvents.campaignId, campaigns.id))
    .leftJoin(recipients, eq(clickEvents.recipientId, recipients.id))
    .where(dateFilters(range, clickEvents.clickedAt).length ? and(...dateFilters(range, clickEvents.clickedAt)) : undefined)
    .orderBy(desc(clickEvents.clickedAt))
    .limit(5000);

  return [...openRows, ...clickRows]
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .slice(0, 5000);
}
