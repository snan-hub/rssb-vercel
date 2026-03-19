const { supabase } = require("./_db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { data } = await supabase.from("scan_log").select("*").order("id", { ascending: false }).limit(1).single();
  res.json(data || null);
};
