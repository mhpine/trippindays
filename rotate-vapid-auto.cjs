const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("Could not find .env.local. Run this from the TrippinDays project root.");
  process.exit(1);
}

const keys = webpush.generateVAPIDKeys();
webpush.setVapidDetails("https://trippindays.com", keys.publicKey, keys.privateKey);

let envText = fs.readFileSync(envPath, "utf8");
function upsert(name, value) {
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  if (re.test(envText)) envText = envText.replace(re, line);
  else envText += `${envText.endsWith("\n") || !envText ? "" : "\n"}${line}\n`;
}

upsert("VAPID_PRIVATE_KEY", keys.privateKey);
upsert("NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.publicKey);
upsert("VAPID_SUBJECT", "https://trippindays.com");
fs.writeFileSync(envPath, envText, "utf8");

console.log("VAPID keys rotated and saved automatically. No copying or typing required.");
console.log("Restart npm run dev, then turn Browser Alerts OFF and ON once.");
