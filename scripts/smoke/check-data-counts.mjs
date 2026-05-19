#!/usr/bin/env node
// Read-only data sanity checks for deployed GPT Image Studio.

import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "gpt_image_studio"
  });
  try {
    const [[prompts]] = await connection.execute("SELECT COUNT(*) AS total FROM prompts");
    const [[genImage]] = await connection.execute("SELECT COUNT(*) AS total FROM prompts WHERE source LIKE 'Gen-Image/%'");
    const [[tags]] = await connection.execute("SELECT COUNT(*) AS total FROM gallery_tags WHERE status = 'active'");
    const [[users]] = await connection.execute("SELECT COUNT(*) AS total FROM users");
    const [[smokeUsers]] = await connection.execute("SELECT COUNT(*) AS total FROM users WHERE email LIKE 'codex-smoke-%@example.test'");
    const [[smokeAnnouncements]] = await connection.execute("SELECT COUNT(*) AS total FROM announcements WHERE title LIKE '[smoke] auth-admin%'");
    const [sample] = await connection.execute(
      "SELECT id, title, source, source_url FROM prompts WHERE source LIKE 'Gen-Image/%' ORDER BY id ASC LIMIT 5"
    );
    console.log(JSON.stringify({
      prompts: Number(prompts.total || 0),
      genImagePrompts: Number(genImage.total || 0),
      activeTags: Number(tags.total || 0),
      users: Number(users.total || 0),
      smokeUsers: Number(smokeUsers.total || 0),
      smokeAnnouncements: Number(smokeAnnouncements.total || 0),
      sample
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
