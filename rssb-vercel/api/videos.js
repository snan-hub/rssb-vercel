const { supabase } = require("./_db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, DELETE, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;

  // DELETE single video
  if (req.method === "DELETE" && id) {
    await supabase.from("videos").delete().eq("id", id);
    return res.json({ success: true });
  }

  // PATCH single video
  if (req.method === "PATCH" && id) {
    const { status, notes } = req.body;
    await supabase.from("videos").update({ status, notes, is_new: false }).eq("id", id);
    return res.json({ success: true });
  }

  // POST bulk update
  if (req.method === "POST") {
    const { ids, status, action } = req.body;
    if (action === "mark-seen") {
      await supabase.from("videos").update({ is_new: false }).neq("id", "");
      return res.json({ success: true });
    }
    if (ids?.length && status) {
      await supabase.from("videos").update({ status, is_new: false }).in("id", ids);
      return res.json({ success: true, updated: ids.length });
    }
    return res.status(400).json({ error: "No IDs provided" });
  }

  // GET videos list
  if (req.method === "GET") {
    const { status, search, onlyNew, sortBy } = req.query;

    let query = supabase.from("videos").select("*");

    if (status && status !== "All") query = query.eq("status", status);
    if (onlyNew === "true") query = query.eq("is_new", true);
    if (search) query = query.or(`title.ilike.%${search}%,channel.ilike.%${search}%`);

    // Sorting
    if (sortBy === "subscribers") query = query.order("subscriber_count", { ascending: false });
    else if (sortBy === "views") query = query.order("view_count", { ascending: false });
    else if (sortBy === "priority") query = query.order("priority", { ascending: true });
    else query = query.order("published_at", { ascending: false });

    const { data: videos, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Stats
    const { count: total } = await supabase.from("videos").select("*", { count: "exact", head: true });
    const { count: unreviewed } = await supabase.from("videos").select("*", { count: "exact", head: true }).eq("status", "Unreviewed");
    const { count: unauthorized } = await supabase.from("videos").select("*", { count: "exact", head: true }).eq("status", "Unauthorized");
    const { count: aiSuspected } = await supabase.from("videos").select("*", { count: "exact", head: true }).eq("status", "AI-Suspected");
    const { count: confirmedFake } = await supabase.from("videos").select("*", { count: "exact", head: true }).eq("status", "Confirmed Fake");
    const { count: newCount } = await supabase.from("videos").select("*", { count: "exact", head: true }).eq("is_new", true);
    const { count: highPriority } = await supabase.from("videos").select("*", { count: "exact", head: true }).eq("priority", "HIGH");

    return res.json({
      videos: videos || [],
      stats: { total, unreviewed, unauthorized, aiSuspected, confirmedFake, newCount, highPriority }
    });
  }

  res.status(405).json({ error: "Method not allowed" });
};
