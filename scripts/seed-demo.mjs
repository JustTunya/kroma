// scripts/seed-demo.mjs
//
// pnpm seed:demo — idempotent. Run once locally after `supabase start`, or
// once against a hosted project to provision + backfill the public demo.
// Re-running is safe: staff bootstrap upserts, history generation skips
// itself once any order exists (see seedHistory in this same file).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_STAFF_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_STAFF_PASSWORD;
const DEMO_PIN = process.env.NEXT_PUBLIC_DEMO_STAFF_PIN;

function requireEnv() {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY],
    ["NEXT_PUBLIC_DEMO_STAFF_EMAIL", DEMO_EMAIL],
    ["NEXT_PUBLIC_DEMO_STAFF_PASSWORD", DEMO_PASSWORD],
    ["NEXT_PUBLIC_DEMO_STAFF_PIN", DEMO_PIN],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

export async function ensureDemoStaff(client) {
  const { data: existing } = await client
    .from("staff")
    .select("id, user_id")
    .eq("is_demo", true)
    .maybeSingle();

  let userId = existing?.user_id;

  if (userId) {
    // Keep the Auth password in sync with whatever the env now says —
    // cheap, and means rotating the published password is a one-command fix.
    const { error } = await client.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
    });
    if (error) throw new Error(`updateUserById failed: ${error.message}`);
  } else {
    try {
      const { data, error } = await client.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser failed: ${error.message}`);
      userId = data.user.id;
    } catch (createErr) {
      // If createUser failed with a duplicate-email error, a previous run may have
      // created the Auth user but crashed before linking it to a staff row. Recover
      // by finding the existing user and continuing to the RPC link step.
      const { data: users, error: listErr } = await client.auth.admin.listUsers({
        limit: 1000,
      });
      if (listErr) throw createErr; // If listing fails, rethrow the original error.
      const existingUser = users?.find((u) => u.email === DEMO_EMAIL);
      if (existingUser) {
        userId = existingUser.id;
        console.log(`Recovered from partial run: found existing Auth user ${DEMO_EMAIL}`);
      } else {
        // User not found in Auth — createUser failed for a different reason, not duplicate email.
        throw createErr;
      }
    }
  }

  const { data: staffRow, error: staffError } = await client.rpc(
    "admin_upsert_demo_staff",
    { p_user_id: userId, p_pin: DEMO_PIN },
  );
  if (staffError) throw new Error(`admin_upsert_demo_staff failed: ${staffError.message}`);

  console.log(`Demo staff ready: ${DEMO_EMAIL} / PIN ${DEMO_PIN} (staff id ${staffRow.id})`);
  return { id: staffRow.id };
}

const HISTORY_DAYS = 30;
const CUSTOMER_COUNT = 10;

const FIRST_NAMES = [
  "Ana", "Mihai", "Ioana", "Andrei", "Elena", "Cristian", "Maria", "Radu",
  "Alexandra", "Bogdan", "Diana", "Vlad",
];
const LAST_NAMES = [
  "Pop", "Ionescu", "Popescu", "Rusu", "Stan", "Dumitrescu", "Marin",
  "Constantin", "Toma", "Barbu",
];
const GUEST_NAMES = [
  "Sofia", "Matei", "Larisa", "Tudor", "Gabriela", "Robert", "Irina",
  "Alex", "Nicoleta", "Dan",
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

function weightedPick(items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

// A small coffee shop's basket composition: drinks far outweigh bakehouse,
// which outweighs the small kitchen menu.
const CATEGORY_WEIGHT = {
  "espresso-bar": 5,
  "tea-alternatives": 2,
  bakehouse: 2.5,
  kitchen: 1,
};

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function serviceHours(date) {
  return isWeekend(date) ? { open: 8.5, close: 17 } : { open: 7.5, close: 18 };
}

function hourWeight(hour, weekend) {
  if (weekend) {
    if (hour >= 9 && hour < 12) return 3;
    if (hour >= 12 && hour < 14) return 2;
    return 1;
  }
  if (hour >= 7 && hour < 9) return 3;
  if (hour >= 12 && hour < 13) return 2;
  if (hour >= 14 && hour < 16) return 0.6;
  return 1;
}

function randomHour(date) {
  const { open, close } = serviceHours(date);
  const weekend = isWeekend(date);
  const hours = [];
  for (let h = open; h < close; h += 0.25) hours.push(h);
  return weightedPick(hours, (h) => hourWeight(Math.floor(h), weekend));
}

function priceLine(item, categoryById) {
  let price = Number(item.base_price);
  const modifiers = [];
  for (const group of item.modifiers ?? []) {
    const option = pick(group.options);
    price += Number(option.priceOffset ?? 0);
    modifiers.push({
      group: group.name,
      option: option.name,
      priceOffset: option.priceOffset ?? 0,
    });
  }
  const category = categoryById.get(item.category_id);
  return {
    modifiers,
    unitPrice: Math.round(price * 100) / 100,
    vatRate: Number(category?.vat_rate ?? 0.19),
    earnsPunch: Boolean(category?.earns_punch),
  };
}

async function seedHistory(client, demoStaffId) {
  const { count } = await client.from("orders").select("id", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`seedHistory: ${count} orders already exist, skipping backfill.`);
    return;
  }

  const { data: items, error: itemsError } = await client
    .from("menu_items")
    .select("id, name, base_price, category_id, modifiers")
    .eq("is_active", true);
  if (itemsError) throw new Error(`menu_items fetch failed: ${itemsError.message}`);

  const { data: categories, error: catError } = await client
    .from("menu_categories")
    .select("id, slug, vat_rate, earns_punch");
  if (catError) throw new Error(`menu_categories fetch failed: ${catError.message}`);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const weightedItems = items.map((item) => {
    const slug = categoryById.get(item.category_id)?.slug;
    return { item, weight: CATEGORY_WEIGHT[slug] ?? 1 };
  });

  // Fake customers: a handful of frequent regulars (index 0-2) and the rest
  // occasional, so punch cards and "is_regular" both have something real to
  // show.
  const customers = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const email = `${firstName}.${lastName}.${i}@demo.kroma.coffee`.toLowerCase();
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: `demo-customer-${i}-${Math.random().toString(36).slice(2)}`,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser (${email}) failed: ${error.message}`);

    await client.from("profiles").insert({
      id: data.user.id,
      display_name: `${firstName} ${lastName}`,
      bar_name: firstName,
      marketing_opt_in: Math.random() < 0.5,
    });

    const favourites = weightedItems
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, randomInt(1, 3));
    for (const { item } of favourites) {
      await client.from("favourites").insert({ user_id: data.user.id, menu_item_id: item.id });
    }

    customers.push({
      userId: data.user.id,
      name: `${firstName} ${lastName}`,
      regular: i < 3,
      punches: 0,
    });
  }

  const today = new Date();
  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - daysAgo);
    const dayStr = day.toISOString().slice(0, 10);
    const weekend = isWeekend(day);
    const orderCount = weekend ? randomInt(45, 70) : randomInt(35, 55);

    const { error: openError } = await client.from("service_days").insert({
      day: dayStr,
      opened_by: demoStaffId,
      opened_at: `${dayStr}T${weekend ? "08:30" : "07:30"}:00Z`,
      next_number: orderCount + 1,
      float_cash: 200,
    });
    if (openError) throw new Error(`service_days insert (${dayStr}) failed: ${openError.message}`);

    for (let n = 1; n <= orderCount; n++) {
      const hour = randomHour(day);
      const placedAt = new Date(day);
      placedAt.setUTCHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);

      const isGuest = Math.random() < 0.55;
      const regularBias = customers.filter((c) => c.regular);
      const customer = isGuest
        ? null
        : Math.random() < 0.5 && regularBias.length > 0
          ? pick(regularBias)
          : pick(customers);

      const lineCount = randomInt(1, 3);
      const lines = [];
      let subtotal = 0;
      let tax = 0;
      for (let i = 0; i < lineCount; i++) {
        const { item } = weightedPick(weightedItems, (w) => w.weight);
        const quantity = Math.random() < 0.15 ? 2 : 1;
        const priced = priceLine(item, categoryById);
        const lineTotal = Math.round(priced.unitPrice * quantity * 100) / 100;
        subtotal += lineTotal;
        tax += Math.round(lineTotal * priced.vatRate * 100) / 100;
        lines.push({
          menu_item_id: item.id,
          item_name: item.name,
          base_price: item.base_price,
          quantity,
          selected_modifiers: priced.modifiers,
          line_total: lineTotal,
          earns_punch: priced.earnsPunch,
          vat_rate: priced.vatRate,
          _punches: priced.earnsPunch ? quantity : 0,
        });
      }

      const isOnline = Math.random() < 0.2;
      const settledAs = isOnline ? "online" : Math.random() < 0.45 ? "cash" : "card";
      const roll = Math.random();
      const status = roll < 0.9 ? "collected" : roll < 0.95 ? "cancelled" : roll < 0.98 ? "refunded" : "abandoned";

      let redeemedLine = null;
      if (customer) {
        customer.punches += lines.reduce((sum, l) => sum + l._punches, 0);
        if (customer.punches >= 10 && lines.length > 0) {
          redeemedLine = lines[0];
          subtotal -= redeemedLine.line_total;
          tax -= Math.round(redeemedLine.line_total * redeemedLine.vat_rate * 100) / 100;
          redeemedLine.line_total = 0;
          customer.punches -= 10;
        }
      }

      subtotal = Math.round(subtotal * 100) / 100;
      tax = Math.round(Math.max(tax, 0) * 100) / 100;

      const { data: order, error: orderError } = await client
        .from("orders")
        .insert({
          status,
          customer_name: customer ? null : pick(GUEST_NAMES),
          user_id: customer?.userId ?? null,
          subtotal,
          total: subtotal,
          tax_total: tax,
          payment_method: isOnline ? "online" : "counter",
          settled_as: status === "cancelled" ? null : settledAs,
          placed_at: placedAt.toISOString(),
          collected_at: status === "collected" ? placedAt.toISOString() : null,
          service_day: dayStr,
          day_number: n,
        })
        .select()
        .single();
      if (orderError) throw new Error(`order insert failed: ${orderError.message}`);

      const { error: lineError } = await client.from("order_items").insert(
        lines.map(({ _punches, ...line }) => ({ ...line, order_id: order.id })),
      );
      if (lineError) throw new Error(`order_items insert failed: ${lineError.message}`);

      if (redeemedLine && customer) {
        const { error: redeemError } = await client.from("card_redemptions").insert({
          user_id: customer.userId,
          order_id: order.id,
          item_name: redeemedLine.item_name,
        });
        if (redeemError) throw new Error(`card_redemptions insert failed: ${redeemError.message}`);
      }
    }

    const { data: report, error: reportError } = await client.rpc("service_report", {
      p_actor: demoStaffId,
      p_day: dayStr,
    });
    if (reportError) throw new Error(`service_report (${dayStr}) failed: ${reportError.message}`);

    const expectedCash = Number(report.expected_cash ?? 0);
    const { error: closeError } = await client
      .from("service_days")
      .update({
        closed_at: `${dayStr}T18:30:00Z`,
        closed_by: demoStaffId,
        counted_cash: Math.round((expectedCash + (Math.random() - 0.5) * 4) * 100) / 100,
        count_detail: {},
        report,
      })
      .eq("day", dayStr);
    if (closeError) throw new Error(`service_days close (${dayStr}) failed: ${closeError.message}`);

    console.log(`seedHistory: ${dayStr} — ${orderCount} orders, closed.`);
  }

  console.log(`seedHistory: backfilled ${HISTORY_DAYS} days for ${CUSTOMER_COUNT} customers.`);
}

async function main() {
  requireEnv();
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const demoStaff = await ensureDemoStaff(client);
  console.log(`demoStaff ready: ${demoStaff.id}`);
  await seedHistory(client, demoStaff.id);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
