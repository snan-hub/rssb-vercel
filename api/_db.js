const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const EXCLUDED_CHANNEL_IDS = ["UCQGBJhmOAqQ7vBH7YPXwJbA"];
const EXCLUDED_CHANNEL_NAMES = ["rssb", "radha soami satsang beas", "rssb official"];

function isOfficialChannel(channelId, channelName) {
  if (EXCLUDED_CHANNEL_IDS.includes(channelId)) return true;
  return EXCLUDED_CHANNEL_NAMES.some(n => (channelName||"").toLowerCase().trim() === n);
}

function getPriority(subscriberCount) {
  const n = parseInt(subscriberCount || 0);
  if (n >= 100000) return "HIGH";
  if (n >= 10000) return "MEDIUM";
  return "LOW";
}

const PRESET_QUERIES = [
  "RSSB satsang", "Radha Soami Beas", "Baba Gurinder Singh",
  "Hazur Jasdeep Singh", "Sant Mat satsang", "RSSB discourse",
  "Radha Soami meditation", "RSSB bhandara", "Sant Mat meditation",
  "Gurinder Singh Dhillon", "Babaji RSSB", "Radha Soami satsang",
  "RSSB kirtan", "Sant Mat initiation", "Dera Beas satsang",
  "RSSB seva", "Radha Soami teachings", "Sant Mat path",
  "RSSB retreat", "Hazur Maharaj Ji satsang",
];

module.exports = { supabase, isOfficialChannel, getPriority, PRESET_QUERIES };
