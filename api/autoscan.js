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

async function searchYouTube(query, publishedAfter) {
  let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&q=${encodeURIComponent(query)}&order=date&videoDuration=any&key=${API_KEY}`;
  if (publishedAfter) url += `&publishedAfter=${publishedAfter}`;
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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!API_KEY) return res.status(500).json({ error: "YouTube API key not configured." });

  const sevenDaysAgo = new Date(Date.now() - 7*86400000).toISOString();
  let totalFound=0, totalAdded=0, totalExcluded=0;
  const results = [];

  for (const query of PRESET_QUERIES) {
    try {
      const data = await searchYouTube(query, sevenDaysAgo);
      if (data.error) { results.push({ query, error: data.error.message }); continue; }

      const items = data.items || [];
      const videoIds = items.map(i => i.id.videoId).filter(Boolean);
      const channelIds = items.map(i => i.snippet.channelId).filter(Boolean);
      const [vDetails, cDetails] = await Promise.all([getVideoDetails(videoIds), getChannelDetails(channelIds)]);

      for (const item of items) {
        const id = item.id.videoId;
        if (!id) continue;
        const s = item.snippet;
        const vd = vDetails[id];
        const cd = cDetails[s.channelId];

        if (isOfficialChannel(s.channelId, s.channelTitle)) { totalExcluded++; continue; }

        const subscriberCount = cd?.statistics?.subscriberCount || "0";
        const priority = getPriority(subscriberCount);
        const videoType = isShort(vd?.contentDetails?.duration) ? "short" : "video";

        // Check if exists
        const { data: existing } = await supabase.from("videos").select("id").eq("id", id).single();

        if (!existing) {
          await supabase.from("videos").insert({
            id, title: s.title, channel: s.channelTitle,
            channel_id: s.channelId,
            channel_url: `https://youtube.com/channel/${s.channelId}`,
            channel_about_url: `https://youtube.com/channel/${s.channelId}/about`,
            published_at: s.publishedAt,
            thumbnail: s.thumbnails?.medium?.url || "",
            url: `https://youtube.com/watch?v=${id}`,
            description: (s.description||"").slice(0,300),
            view_count: vd?.statistics?.viewCount || "0",
            subscriber_count: subscriberCount,
            priority, search_term: query,
            is_new: true, video_type: videoType
          });
          totalAdded++;
        } else {
          await supabase.from("videos").update({
            view_count: vd?.statistics?.viewCount || "0",
            subscriber_count: subscriberCount,
            priority
          }).eq("id", id);
        }
        totalFound++;
      }
      results.push({ query, found: items.length });
      await new Promise(r => setTimeout(r, 300));
    } catch(e) {
      results.push({ query, error: e.message });
    }
  }

  await supabase.from("scan_log").insert({
    scanned_at: new Date().toISOString(),
    total_found: totalFound,
    new_found: totalAdded,
    excluded: totalExcluded
  });

  res.json({ success: true, totalFound, newFound: totalAdded, totalExcluded, results });
};
