const fetch = require("node-fetch");
const { supabase, isOfficialChannel, getPriority } = require("./_db");

const API_KEY = process.env.YOUTUBE_API_KEY;

function isShort(duration) {
  if (!duration) return false;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return false;
  const secs = (parseInt(match[1]||0)*3600)+(parseInt(match[2]||0)*60)+parseInt(match[3]||0);
  return secs <= 60;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!API_KEY) return res.status(500).json({ error: "YouTube API key not configured." });

  const { q, order, publishedAfter, pageToken } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query." });

  try {
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&q=${encodeURIComponent(q)}&order=${order||"date"}&videoDuration=any&key=${API_KEY}`;
    if (publishedAfter) url += `&publishedAfter=${publishedAfter}`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const searchRes = await fetch(url);
    const data = await searchRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const videoIds = (data.items||[]).map(i => i.id.videoId).filter(Boolean);
    const channelIds = (data.items||[]).map(i => i.snippet.channelId).filter(Boolean);

    const [vRes, cRes] = await Promise.all([
      fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds.join(",")}&key=${API_KEY}`),
      fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${[...new Set(channelIds)].join(",")}&key=${API_KEY}`)
    ]);
    const vData = await vRes.json();
    const cData = await cRes.json();

    const vMap = {}; (vData.items||[]).forEach(i => { vMap[i.id] = i; });
    const cMap = {}; (cData.items||[]).forEach(i => { cMap[i.id] = i; });

    const enriched = await Promise.all((data.items||[]).map(async item => {
      const id = item.id.videoId;
      const vd = vMap[id];
      const cd = cMap[item.snippet.channelId];
      const subCount = cd?.statistics?.subscriberCount || "0";
      const { data: dbRecord } = await supabase.from("videos").select("status,is_new").eq("id", id).single();
      return {
        ...item,
        viewCount: vd?.statistics?.viewCount || null,
        subscriberCount: subCount,
        priority: getPriority(subCount),
        dbStatus: dbRecord?.status || null,
        isNew: dbRecord?.is_new || false,
        isOfficial: isOfficialChannel(item.snippet.channelId, item.snippet.channelTitle),
        videoType: isShort(vd?.contentDetails?.duration) ? "short" : "video",
        channelAboutUrl: `https://youtube.com/channel/${item.snippet.channelId}/about`
      };
    }));

    res.json({ ...data, items: enriched });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
