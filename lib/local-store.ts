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
  clickUrl: string | null;
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

type LocalClickEvent = {
  id: number;
  trackingId: string;
  recipientId: number | null;
  campaignId: number | null;
  ipAddress: string;
  userAgent: string | null;
  country: string | null;
  destinationUrl: string | null;
  isUnique: boolean;
  clickedAt: string;
};

type LocalIgnoredClient = {
  id: number;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
};

type LocalStore = {
  campaigns: LocalCampaign[];
  recipients: LocalRecipient[];
  openEvents: LocalOpenEvent[];
  clickEvents: LocalClickEvent[];
  ignoredClients: LocalIgnoredClient[];
};

const storePath = path.join(process.cwd(), ".data", "pixeltrack-local.json");

function localPixelUrl(trackingId: string) {
  return `${getBaseUrl()}/api/open?id=${encodeURIComponent(trackingId)}`;
}

function localClickUrl(trackingId: string) {
  return `${getBaseUrl()}/api/click?id=${encodeURIComponent(trackingId)}`;
}

async function readStore(): Promise<LocalStore> {
  try {
    const content = await readFile(storePath, "utf8");
    const parsed = JSON.parse(content) as Partial<LocalStore>;
    return {
      campaigns: parsed.campaigns ?? [],
      recipients: parsed.recipients ?? [],
      openEvents: parsed.openEvents ?? [],
      clickEvents: parsed.clickEvents ?? [],
      ignoredClients: parsed.ignoredClients ?? [],
    };
  } catch {
    return { campaigns: [], recipients: [], openEvents: [], clickEvents: [], ignoredClients: [] };
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

function isIgnored(store: LocalStore, ipAddress: string) {
  return store.ignoredClients.some((client) => client.ipAddress === ipAddress);
}

function visibleOpens(store: LocalStore, range: DateRange = {}) {
  return store.openEvents.filter((event) => inRange(event.openedAt, range) && !isIgnored(store, event.ipAddress));
}

function visibleClicks(store: LocalStore, range: DateRange = {}) {
  return store.clickEvents.filter((event) => inRange(event.clickedAt, range) && !isIgnored(store, event.ipAddress));
}

export async function localIgnoreClient(input: { ipAddress: string; userAgent: string | null }) {
  const store = await readStore();

  if (!isIgnored(store, input.ipAddress)) {
    store.ignoredClients.unshift({
      id: nextId(store.ignoredClients),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: new Date().toISOString(),
    });
    await writeStore(store);
  }
}

export async function localRemoveIgnoredClient(id: number) {
  const store = await readStore();
  const nextIgnoredClients = store.ignoredClients.filter((client) => client.id !== id);

  if (nextIgnoredClients.length !== store.ignoredClients.length) {
    await writeStore({ ...store, ignoredClients: nextIgnoredClients });
  }
}

export async function localResetRecipientReport(recipientId: number) {
  const store = await readStore();
  const recipient = store.recipients.find((row) => row.id === recipientId);

  if (!recipient) {
    return;
  }

  await writeStore({
    ...store,
    openEvents: store.openEvents.filter((event) => event.trackingId !== recipient.trackingId),
    clickEvents: store.clickEvents.filter((event) => event.trackingId !== recipient.trackingId),
  });
}

export async function localDeleteRecipientTracking(recipientId: number) {
  const store = await readStore();
  const recipient = store.recipients.find((row) => row.id === recipientId);

  if (!recipient) {
    return;
  }

  const campaignRecipientCount = store.recipients.filter((row) => row.campaignId === recipient.campaignId).length;
  const deleteCampaign = campaignRecipientCount <= 1;

  await writeStore({
    campaigns: deleteCampaign
      ? store.campaigns.filter((campaign) => campaign.id !== recipient.campaignId)
      : store.campaigns,
    recipients: deleteCampaign
      ? store.recipients.filter((row) => row.campaignId !== recipient.campaignId)
      : store.recipients.filter((row) => row.id !== recipient.id),
    openEvents: store.openEvents.filter((event) =>
      deleteCampaign ? event.campaignId !== recipient.campaignId : event.trackingId !== recipient.trackingId,
    ),
    clickEvents: store.clickEvents.filter((event) =>
      deleteCampaign ? event.campaignId !== recipient.campaignId : event.trackingId !== recipient.trackingId,
    ),
    ignoredClients: store.ignoredClients,
  });
}

export async function localCreateCampaign(input: {
  name: string;
  description?: string;
  clickUrl?: string;
  slug: string;
  recipients: { email: string | null; label: string | null; trackingId: string }[];
}) {
  const store = await readStore();
  const now = new Date().toISOString();
  const campaign: LocalCampaign = {
    id: nextId(store.campaigns),
    name: input.name,
    description: input.description || null,
    clickUrl: input.clickUrl || null,
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

export async function localRecordClick(input: {
  trackingId: string;
  ipAddress: string;
  userAgent: string | null;
  country?: string | null;
}) {
  const store = await readStore();
  const recipient = store.recipients.find((row) => row.trackingId === input.trackingId);
  const campaign = store.campaigns.find((row) => row.id === recipient?.campaignId);
  const destinationUrl = campaign?.clickUrl || getBaseUrl();

  if (isIgnored(store, input.ipAddress)) {
    return destinationUrl;
  }

  const isUnique = !store.clickEvents.some(
    (event) => event.trackingId === input.trackingId && event.ipAddress === input.ipAddress,
  );

  store.clickEvents.unshift({
    id: nextId(store.clickEvents),
    trackingId: input.trackingId,
    recipientId: recipient?.id ?? null,
    campaignId: recipient?.campaignId ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    country: input.country ?? null,
    destinationUrl,
    isUnique,
    clickedAt: new Date().toISOString(),
  });

  await writeStore(store);
  return destinationUrl;
}

export async function localGetClickDestination(trackingId: string) {
  const store = await readStore();
  const recipient = store.recipients.find((row) => row.trackingId === trackingId);
  const campaign = store.campaigns.find((row) => row.id === recipient?.campaignId);

  return campaign?.clickUrl || getBaseUrl();
}

export async function localRecordOpen(input: {
  trackingId: string;
  ipAddress: string;
  userAgent: string | null;
  country?: string | null;
}) {
  const store = await readStore();
  const recipient = store.recipients.find((row) => row.trackingId === input.trackingId);

  if (isIgnored(store, input.ipAddress)) {
    return;
  }

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
  const events = visibleOpens(store, range);
  const clickEvents = visibleClicks(store, range);

  return {
    ignoredClients: store.ignoredClients
      .map((client) => ({
        ...client,
        createdAt: new Date(client.createdAt),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
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
    latestClicks: clickEvents.slice(0, 12).map((event) => {
      const recipient = store.recipients.find((row) => row.id === event.recipientId);
      const campaign = store.campaigns.find((row) => row.id === event.campaignId);

      return {
        id: event.id,
        clickedAt: new Date(event.clickedAt),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        destinationUrl: event.destinationUrl,
        isUnique: event.isUnique,
        campaignName: campaign?.name ?? null,
        email: recipient?.email ?? null,
        label: recipient?.label ?? null,
      };
    }),
  };
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
    const events = visibleOpens(store).filter((row) => row.trackingId === recipient.trackingId);
    const clicks = visibleClicks(store).filter((row) => row.trackingId === recipient.trackingId);
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
      totalClicks: clicks.length,
      uniqueClicks: clicks.filter((event) => event.isUnique).length,
      pixelUrl: url,
      pixelHtml: trackingPixelHtml(url),
      clickUrl: localClickUrl(recipient.trackingId),
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

  const openRows = visibleOpens(store, range).map((event) => {
    const recipient = store.recipients.find((row) => row.id === event.recipientId);
    const campaign = store.campaigns.find((row) => row.id === event.campaignId);

    return {
      eventType: "open",
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

  const clickRows = visibleClicks(store, range).map((event) => {
    const recipient = store.recipients.find((row) => row.id === event.recipientId);
    const campaign = store.campaigns.find((row) => row.id === event.campaignId);

    return {
      eventType: "click",
      openedAt: new Date(event.clickedAt),
      trackingId: event.trackingId,
      campaignName: campaign?.name ?? null,
      email: recipient?.email ?? null,
      label: recipient?.label ?? null,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      isUnique: event.isUnique,
    };
  });

  return [...openRows, ...clickRows].sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
}
