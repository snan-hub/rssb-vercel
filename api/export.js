const { supabase } = require("./_db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { data: videos } = await supabase.from("videos").select("*").order("subscriber_count", { ascending: false });
  const headers = ["Title","Channel","Subscribers","Views","Priority","Type","Status","Notes","Published","Channel URL","Channel About","URL","Search Term","First Seen"];
  const rows = (videos||[]).map(v => [v.title,v.channel,v.subscriber_count,v.view_count,v.priority,v.video_type,v.status,v.notes,v.published_at,v.channel_url,v.channel_about_url,v.url,v.search_term,v.first_seen]);
  const csv = [headers,...rows].map(r => r.map(c => `"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition",`attachment; filename=RSSB_Videos_${new Date().toISOString().split("T")[0]}.csv`);
  res.send(csv);
};
