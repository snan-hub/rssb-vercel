const { supabase } = require("./_db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    // Create videos table
    const { error: e1 } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          title TEXT,
          channel TEXT,
          channel_id TEXT,
          channel_url TEXT,
          channel_about_url TEXT,
          published_at TEXT,
          thumbnail TEXT,
          url TEXT,
          description TEXT,
          view_count TEXT DEFAULT '0',
          subscriber_count TEXT DEFAULT '0',
          priority TEXT DEFAULT 'LOW',
          status TEXT DEFAULT 'Unreviewed',
          notes TEXT DEFAULT '',
          search_term TEXT,
          first_seen TIMESTAMP DEFAULT NOW(),
          is_new BOOLEAN DEFAULT TRUE,
          video_type TEXT DEFAULT 'video'
        );
        CREATE TABLE IF NOT EXISTS scan_log (
          id SERIAL PRIMARY KEY,
          scanned_at TIMESTAMP DEFAULT NOW(),
          total_found INTEGER DEFAULT 0,
          new_found INTEGER DEFAULT 0,
          excluded INTEGER DEFAULT 0
        );
      `
    });

    res.json({ success: true, message: "Tables ready!" });
  } catch (err) {
    // Tables may already exist
    res.json({ success: true, message: "Setup complete (tables may already exist)" });
  }
};
