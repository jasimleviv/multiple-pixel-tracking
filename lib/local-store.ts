import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getBaseUrl, trackingPixelHtml } from "@/lib/utils";

type DateRange = {
  from?: string;
  to?: string;
  q?: string;
  page?: number;
};

type LocalCampaign = {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  createdAt: string;
};

type LocalRecipient = {
  id: number;
  campaignId: number;
  email: string | null;
  label: string | null;
  trackingId: string;
  createdAt: string;
};

type LocalOpenEvent = {
  id: number;
  trackingId: string;
  recipientId: number | null;
  campaignId: number | null;
  ipAddress: string;
  userAgent: string | null;
  country: string | null;
  isUnique: boolean;
  openedAt: string;
};

type LocalStore = {
  campaigns: LocalCampaign[];
  recipients: LocalRecipient[];
  openEvents: LocalOpenEvent[];
};

const storePath = path.join(process.cwd(), ".data", "pixeltrack-local.json");

function localPixelUrl(trackingId: string) {
  return `${getBaseUrl()}/api/open?id=${encodeURIComponent(trackingId)}`;
}

async function readStore(): Promise<LocalStore> {
  try {
    const content = await readFile(storePath, "utf8");
    return JSON.parse(content) as LocalStore;
  } catch {
    return { campaigns: [], recipients: [], openEvents: [] };
  }
}

async function writeStore(store: LocalStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function nextId(items: { id: number }[]) {
  return Math.max(0, ...items.map((item) => item.id)) + 1;
}

function inRange(date: string, range: DateRange) {
  const time = new Date(date).getTime();

  if (range.from && time < new Date(`${range.from}T00:00:00.000Z`).getTime()) {
    return false;
  }

  if (range.to && time > new Date(`${range.to}T23:59:59.999Z`).getTime()) {
    return false;
  }

  return true;
}

export async function localCreateCampaign(input: {
  name: string;
  description?: string;
  slug: string;
  recipients: { email: string | null; label: string | null; trackingId: string }[];
}) {
  const store = await readStore();
  const now = new Date().toISOString();
  const campaign: LocalCampaign = {
    id: nextId(store.campaigns),
    name: input.name,
    description: input.description || null,
    slug: input.slug,
    createdAt: now,
  };

  const firstRecipientId = nextId(store.recipients);
  const recipients = input.recipients.map((recipient, index): LocalRecipient => ({
    id: firstRecipientId + index,
    campaignId: campaign.id,
    email: recipient.email,
    label: recipient.label,
    trackingId: recipient.trackingId,
    createdAt: now,
  }));

  store.campaigns.unshift(campaign);
  store.recipients.unshift(...recipients);
  await writeStore(store);
}

export async function localRecordOpen(input: {
  trackingId: string;
  ipAddress: string;
  userAgent: string | null;
  country?: string | null;
}) {
  const store = await readStore();
  const recipient = store.recipients.find((row) => row.trackingId === input.trackingId);
  const isUnique = !store.openEvents.some(
    (event) => event.trackingId === input.trackingId && event.ipAddress === input.ipAddress,
  );

  store.openEvents.unshift({
    id: nextId(store.openEvents),
    trackingId: input.trackingId,
    recipientId: recipient?.id ?? null,
    campaignId: recipient?.campaignId ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    country: input.country ?? null,
    isUnique,
    openedAt: new Date().toISOString(),
  });

  await writeStore(store);
}

export async function localDashboardData(range: DateRange = {}) {
  const store = await readStore();
  const events = store.openEvents.filter((event) => inRange(event.openedAt, range));
  const uniqueOpens = events.filter((event) => event.isUnique).length;
  const dayMap = new Map<string, { day: string; opens: number; unique: number }>();
  const agentMap = new Map<string, number>();

  for (const event of events) {
    const day = event.openedAt.slice(0, 10);
    const dayRow = dayMap.get(day) ?? { day, opens: 0, unique: 0 };
    dayRow.opens += 1;
    dayRow.unique += event.isUnique ? 1 : 0;
    dayMap.set(day, dayRow);

    const agent = event.userAgent || "Unknown";
    agentMap.set(agent, (agentMap.get(agent) ?? 0) + 1);
  }

  return {
    totalOpens: events.length,
    uniqueOpens,
    duplicateOpens: events.length - uniqueOpens,
    openRate: store.recipients.length ? (uniqueOpens / store.recipients.length) * 100 : 0,
    recipientCount: store.recipients.length,
    latestOpens: events.slice(0, 12).map((event) => {
      const recipient = store.recipients.find((row) => row.id === event.recipientId);
      const campaign = store.campaigns.find((row) => row.id === event.campaignId);

      return {
        id: event.id,
        openedAt: new Date(event.openedAt),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        isUnique: event.isUnique,
        campaignName: campaign?.name ?? null,
        email: recipient?.email ?? null,
        label: recipient?.label ?? null,
      };
    }),
    opensByDay: Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
    topUserAgents: Array.from(agentMap.entries())
      .map(([userAgent, opens]) => ({ userAgent, opens }))
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 6),
  };
}

export async function localCampaigns() {
  const store = await readStore();

  return store.campaigns.slice(0, 12).map((campaign) => {
    const recipients = store.recipients.filter((row) => row.campaignId === campaign.id);
    const events = store.openEvents.filter((row) => row.campaignId === campaign.id);

    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      createdAt: new Date(campaign.createdAt),
      recipients: recipients.length,
      totalOpens: events.length,
      uniqueOpens: events.filter((event) => event.isUnique).length,
    };
  });
}

export async function localRecipients(range: DateRange = {}) {
  const store = await readStore();
  const page = Math.max(1, range.page ?? 1);
  const pageSize = 10;
  const query = range.q?.toLowerCase();
  const filtered = query
    ? store.recipients.filter((recipient) =>
        [recipient.email, recipient.label, recipient.trackingId].some((value) =>
          value?.toLowerCase().includes(query),
        ),
      )
    : store.recipients;

  const rows = filtered.slice((page - 1) * pageSize, page * pageSize).map((recipient) => {
    const campaign = store.campaigns.find((row) => row.id === recipient.campaignId);
    const events = store.openEvents.filter((row) => row.trackingId === recipient.trackingId);
    const url = localPixelUrl(recipient.trackingId);

    return {
      id: recipient.id,
      email: recipient.email,
      label: recipient.label,
      trackingId: recipient.trackingId,
      campaignName: campaign?.name ?? null,
      createdAt: new Date(recipient.createdAt),
      totalOpens: events.length,
      uniqueOpens: events.filter((event) => event.isUnique).length,
      pixelUrl: url,
      pixelHtml: trackingPixelHtml(url),
    };
  });

  return {
    rows,
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  };
}

export async function localCsvRows(range: DateRange = {}) {
  const store = await readStore();

  return store.openEvents.filter((event) => inRange(event.openedAt, range)).map((event) => {
    const recipient = store.recipients.find((row) => row.id === event.recipientId);
    const campaign = store.campaigns.find((row) => row.id === event.campaignId);

    return {
      openedAt: new Date(event.openedAt),
      trackingId: event.trackingId,
      campaignName: campaign?.name ?? null,
      email: recipient?.email ?? null,
      label: recipient?.label ?? null,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      isUnique: event.isUnique,
    };
  });
}
