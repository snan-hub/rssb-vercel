const fetch = require("node-fetch");
const { supabase, isOfficialChannel, getPriority, PRESET_QUERIES } = require("./_db");

const API_KEY = process.env.YOUTUBE_API_KEY;

function isShort(duration) {
  if (!duration) return false;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;
  const secs = (parseInt(match[1]||0)*3600)+(parseInt(match[2]||0)*60)+parseInt(match[3]||0);
  return secs <= 60;
}

async function searchYouTube(query) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(query)}&order=date&videoDuration=any&key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getVideoDetails(ids) {
  if (!ids.length) return {};
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${ids.join(",")}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const map = {};
  (data.items||[]).forEach(i => { map[i.id] = i; });
  return map;
}

async function getChannelDetails(ids) {
  if (!ids.length) return {};
  const unique = [...new Set(ids)];
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${unique.join(",")}&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const map = {};
  (data.items||[]).forEach(i => { map[i.id] = i; });
  return map;
}

async function processQuery(query) {
  const data = await searchYouTube(query);
  if (data.error) return { found: 0, added: 0, excluded: 0, error: data.error.message };

  const items = data.items || [];
  if (!items.length) return { found: 0, added: 0, excluded: 0 };

  const videoIds = items.map(i => i.id.videoId).filter(Boolean);
  const channelIds = items.map(i => i.snippet.channelId).filter(Boolean);
  const [vDetails, cDetails] = await Promise.all([
    getVideoDetails(videoIds),
    getChannelDetails(channelIds)
  ]);

  let found = 0, added = 0, excluded = 0;
  const inserts = [];

  for (const item of items) {
    const id = item.id.videoId;
    if (!id) continue;
    const s = item.snippet;
    const vd = vDetails[id];
    const cd = cDetails[s.channelId];

    if (isOfficialChannel(s.channelId, s.channelTitle)) { excluded++; continue; }

    const subscriberCount = cd?.statistics?.subscriberCount || "0";
    const priority = getPriority(subscriberCount);
    const videoType = isShort(vd?.contentDetails?.duration) ? "short" : "video";

    const { data: existing } = await supabase.from("videos").select("id").eq("id", id).single();

    if (!existing) {
      inserts.push({
        id, title: s.title, channel: s.channelTitle,
        channel_id: s.channelId,
        channel_url: `https://youtube.com/channel/${s.channelId}`,
        channel_about_url: `https://youtube.com/channel/${s.channelId}/about`,
        published_at: s.publishedAt,
        thumbnail: s.thumbnails?.medium?.url || "",
        url: `https://youtube.com/watch?v=${id}`,
        description: (s.description||"").slice(0, 300),
        view_count: vd?.statistics?.viewCount || "0",
        subscriber_count: subscriberCount,
        priority, search_term: query,
        is_new: true, video_type: videoType
      });
      added++;
    } else {
      await supabase.from("videos").update({
        view_count: vd?.statistics?.viewCount || "0",
        subscriber_count: subscriberCount,
        priority
      }).eq("id", id);
    }
    found++;
  }

  // Batch insert all new videos at once
  if (inserts.length > 0) {
    await supabase.from("videos").upsert(inserts, { onConflict: "id", ignoreDuplicates: true });
  }

  return { found, added, excluded };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!API_KEY) return res.status(500).json({ error: "YouTube API key not configured." });

  // Batch mode: scan only a subset of queries per call
  // batch=0 scans queries 0-9, batch=1 scans 10-19, etc.
  const batch = parseInt(req.body?.batch ?? -1);
  const BATCH_SIZE = 10;

  let queriesToRun;
  if (batch >= 0) {
    // Scan specific batch
    const start = batch * BATCH_SIZE;
    queriesToRun = PRESET_QUERIES.slice(start, start + BATCH_SIZE);
  } else {
    // Scan first batch only (default - fast scan)
    queriesToRun = PRESET_QUERIES.slice(0, BATCH_SIZE);
  }

  let totalFound = 0, totalAdded = 0, totalExcluded = 0;
  const results = [];

  for (const query of queriesToRun) {
    try {
      const r = await processQuery(query);
      totalFound += r.found;
      totalAdded += r.added;
      totalExcluded += r.excluded || 0;
      results.push({ query, ...r });
    } catch(e) {
      results.push({ query, error: e.message });
    }
    await new Promise(r => setTimeout(r, 200));
  }

  await supabase.from("scan_log").insert({
    scanned_at: new Date().toISOString(),
    total_found: totalFound,
    new_found: totalAdded,
    excluded: totalExcluded
  });

  const totalBatches = Math.ceil(PRESET_QUERIES.length / BATCH_SIZE);
  const nextBatch = (batch + 1) < totalBatches ? batch + 1 : null;

  res.json({
    success: true,
    totalFound, newFound: totalAdded, totalExcluded,
    batch: batch >= 0 ? batch : 0,
    nextBatch,
    totalBatches,
    results
  });
};
