import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    clickUrl: text("click_url"),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("campaigns_slug_idx").on(table.slug),
    createdAtIdx: index("campaigns_created_at_idx").on(table.createdAt),
  }),
);

export const recipients = pgTable(
  "recipients",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    email: varchar("email", { length: 254 }),
    label: varchar("label", { length: 180 }),
    trackingId: varchar("tracking_id", { length: 96 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("recipients_campaign_id_idx").on(table.campaignId),
    trackingIdx: uniqueIndex("recipients_tracking_id_idx").on(table.trackingId),
    emailIdx: index("recipients_email_idx").on(table.email),
  }),
);

export const openEvents = pgTable(
  "open_events",
  {
    id: serial("id").primaryKey(),
    trackingId: varchar("tracking_id", { length: 96 }).notNull(),
    recipientId: integer("recipient_id").references(() => recipients.id, { onDelete: "set null" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    ipAddress: varchar("ip_address", { length: 96 }).notNull(),
    userAgent: text("user_agent"),
    country: varchar("country", { length: 80 }),
    isUnique: boolean("is_unique").default(false).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    trackingIdx: index("open_events_tracking_id_idx").on(table.trackingId),
    recipientIdx: index("open_events_recipient_id_idx").on(table.recipientId),
    campaignIdx: index("open_events_campaign_id_idx").on(table.campaignId),
    openedAtIdx: index("open_events_opened_at_idx").on(table.openedAt),
    uniqueFlagIdx: index("open_events_unique_idx").on(table.isUnique),
    ipIdx: index("open_events_ip_address_idx").on(table.ipAddress),
  }),
);

export const uniqueOpens = pgTable(
  "unique_opens",
  {
    id: serial("id").primaryKey(),
    trackingId: varchar("tracking_id", { length: 96 }).notNull(),
    recipientId: integer("recipient_id").references(() => recipients.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    ipAddress: varchar("ip_address", { length: 96 }).notNull(),
    userAgent: text("user_agent"),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    trackingIpIdx: uniqueIndex("unique_opens_tracking_ip_idx").on(table.trackingId, table.ipAddress),
    campaignIdx: index("unique_opens_campaign_id_idx").on(table.campaignId),
    recipientIdx: index("unique_opens_recipient_id_idx").on(table.recipientId),
    firstOpenedAtIdx: index("unique_opens_first_opened_at_idx").on(table.firstOpenedAt),
  }),
);

export const clickEvents = pgTable(
  "click_events",
  {
    id: serial("id").primaryKey(),
    trackingId: varchar("tracking_id", { length: 96 }).notNull(),
    recipientId: integer("recipient_id").references(() => recipients.id, { onDelete: "set null" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    ipAddress: varchar("ip_address", { length: 96 }).notNull(),
    userAgent: text("user_agent"),
    country: varchar("country", { length: 80 }),
    destinationUrl: text("destination_url"),
    isUnique: boolean("is_unique").default(false).notNull(),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    trackingIdx: index("click_events_tracking_id_idx").on(table.trackingId),
    recipientIdx: index("click_events_recipient_id_idx").on(table.recipientId),
    campaignIdx: index("click_events_campaign_id_idx").on(table.campaignId),
    clickedAtIdx: index("click_events_clicked_at_idx").on(table.clickedAt),
    uniqueFlagIdx: index("click_events_unique_idx").on(table.isUnique),
    ipIdx: index("click_events_ip_address_idx").on(table.ipAddress),
  }),
);

export const uniqueClicks = pgTable(
  "unique_clicks",
  {
    id: serial("id").primaryKey(),
    trackingId: varchar("tracking_id", { length: 96 }).notNull(),
    recipientId: integer("recipient_id").references(() => recipients.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    ipAddress: varchar("ip_address", { length: 96 }).notNull(),
    userAgent: text("user_agent"),
    firstClickedAt: timestamp("first_clicked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    trackingIpIdx: uniqueIndex("unique_clicks_tracking_ip_idx").on(table.trackingId, table.ipAddress),
    campaignIdx: index("unique_clicks_campaign_id_idx").on(table.campaignId),
    recipientIdx: index("unique_clicks_recipient_id_idx").on(table.recipientId),
    firstClickedAtIdx: index("unique_clicks_first_clicked_at_idx").on(table.firstClickedAt),
  }),
);

export type Campaign = typeof campaigns.$inferSelect;
export type Recipient = typeof recipients.$inferSelect;
export type OpenEvent = typeof openEvents.$inferSelect;
