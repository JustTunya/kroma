// Usage: node scripts/indexnow.mjs [url ...]   (defaults to the public routes)
const host = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://kroma.lenardtunya.com").origin;
const key = process.env.INDEXNOW_KEY ?? (await import("node:fs")).readdirSync("public").find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, 32);
const urlList = process.argv.length > 2 ? process.argv.slice(2) : [`${host}/`, `${host}/privacy`];

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(host).host, key, keyLocation: `${host}/${key}.txt`, urlList }),
});
console.log(res.status, res.statusText);
