import { load } from "cheerio";
import fetch from "node-fetch";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Origin, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    res.setHeader("Content-Type", "text/plain");
    const response = await fetch("https://example.com");
    const html = await response.text();
    const $ = load(html);
    const title = $("h1").text();
    const links = $("a")
      .map((i, el) => $(el).attr("href"))
      .get();
    
    console.log("html", html);
    res.send(`${title} ${links}`);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
}