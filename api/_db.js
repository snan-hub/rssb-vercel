const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (...args) => fetch(...args) },
});

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

// ─── 50 SEARCH TERMS (English + Hindi + Punjabi) ─────────────────────────────
const PRESET_QUERIES = [
  // Core English
  "RSSB satsang", "Radha Soami Beas", "Baba Gurinder Singh",
  "Hazur Jasdeep Singh", "Sant Mat satsang", "RSSB discourse",
  "Radha Soami meditation", "RSSB bhandara", "Sant Mat meditation",
  "Gurinder Singh Dhillon", "Babaji RSSB", "Radha Soami satsang",
  "RSSB kirtan", "Sant Mat initiation", "Dera Beas satsang",
  "RSSB seva", "Radha Soami teachings", "Sant Mat path",
  "RSSB retreat", "Hazur Maharaj Ji satsang",
  // More English
  "Radha Soami Beas satsang", "RSSB spiritual discourse",
  "Gurinder Singh satsang", "Sant Mat naam", "Radha Soami shabd",
  "RSSB naam daan", "Dera Beas bhandara", "Radha Soami Beas kirtan",
  "Sant Mat simran", "RSSB meditation", "Radha Swami satsang",
  "Radhaswami Beas", "RSSB video", "Baba Ji satsang RSSB",
  "Sant Mat shabd", "Radha Soami Beas bhandara",
  // Hindi
  "राधास्वामी सत्संग", "बाबा गुरिंदर सिंह", "संत मत सत्संग",
  "राधा स्वामी बेस", "हुजूर जसदीप सिंह", "राधास्वामी ध्यान",
  "संत मत नाम", "डेरा ब्यास सत्संग", "राधास्वामी सेवा", "बाबाजी सत्संग",
  // Punjabi
  "ਰਾਧਾਸੁਆਮੀ ਸਤਿਸੰਗ", "ਬਾਬਾ ਗੁਰਿੰਦਰ ਸਿੰਘ",
  "ਸੰਤ ਮਤ ਸਤਿਸੰਗ", "ਡੇਰਾ ਬਿਆਸ",
];

module.exports = { supabase, isOfficialChannel, getPriority, PRESET_QUERIES };
