import fetch from "node-fetch";
import { fetchTweetsHeadless } from "../src/lib/headless.js";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Origin, Content-Type, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { url, limit = 50 } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ message: "Twitter profile URL is required" });
    }

    // Extract the username from the provided URL
    let username = "";
    try {
      const parsed = new URL(url);
      username = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } catch {
      return res.status(400).json({ message: "Invalid URL supplied" });
    }

    if (!username) {
      return res
        .status(400)
        .json({ message: "Could not extract username from the URL" });
    }

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;

    // If no bearer token, use headless scraping with chromium-min
    if (!bearerToken) {
      try {
        const posts = await fetchTweetsHeadless(username, limit);
        return res.json({ success: true, user: username, posts });
      } catch (headlessErr) {
        console.error("Headless scrape failed:", headlessErr);
        return res.status(500).json({
          message: "Scraping failed",
          error:
            headlessErr instanceof Error
              ? headlessErr.message
              : "Unknown error",
        });
      }
    }

    const headers = {
      Authorization: `Bearer ${bearerToken}`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    };

    // 1. Resolve the user ID
    const userResp = await fetch(
      `https://api.twitter.com/2/users/by/username/${username}?user.fields=id`,
      { headers }
    );

    if (!userResp.ok) {
      const errData = await userResp.json().catch(() => ({}));
      throw new Error(
        `Twitter user lookup failed: ${userResp.statusText} ${
          errData.title || ""
        }`
      );
    }

    const userJson = await userResp.json();
    const userId = userJson?.data?.id;
    if (!userId) {
      return res.status(404).json({ message: "User not found on Twitter" });
    }

    // 2. Fetch the user's tweets (max 100)
    const tweetsResp = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=100&tweet.fields=created_at,attachments,conversation_id&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`,
      { headers }
    );

    if (!tweetsResp.ok) {
      const errData = await tweetsResp.json().catch(() => ({}));
      throw new Error(
        `Tweets fetch failed: ${tweetsResp.statusText} ${errData.title || ""}`
      );
    }

    const timeline = await tweetsResp.json();

    // Build a quick lookup for media (photos, videos, gifs)
    const mediaMap = {};
    if (timeline.includes?.media) {
      for (const media of timeline.includes.media) {
        mediaMap[media.media_key] = media;
      }
    }

    // Transform tweets into the shape we want
    const posts = (timeline.data || []).map((tweet) => {
      const images = [];
      const videos = [];

      if (tweet.attachments?.media_keys) {
        tweet.attachments.media_keys.forEach((key) => {
          const media = mediaMap[key];
          if (!media) return;

          if (media.type === "photo" && media.url) {
            images.push(media.url);
          } else if (
            (media.type === "video" || media.type === "animated_gif") &&
            media.preview_image_url
          ) {
            videos.push(media.preview_image_url);
          }
        });
      }

      return {
        id: tweet.id,
        text: tweet.text,
        images,
        videos,
        date: tweet.created_at,
        conversation_id: tweet.conversation_id,
      };
    });

    return res.json({ success: true, user: username, posts });
  } catch (error) {
    console.error("Error scraping tweets:", error);
    return res.status(500).json({
      message: "Failed to fetch tweets",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
