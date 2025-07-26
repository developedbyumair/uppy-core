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

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({
        message: "LinkedIn post URL is required",
      });
    }

    // Custom headers to mimic a browser
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Upgrade-Insecure-Requests": "1",
    };

    // Fetch the LinkedIn page
    const response = await fetch(url, { headers });
    const html = await response.text();

    // Load HTML into Cheerio
    const $ = load(html);

    // Extract post data
    const postData = {
      text: "",
      images: [],
      author: "",
      date: "",
    };

    // Get post content
    postData.text = $(".attributed-text-segment-list__container")
      .text()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n+/g, "\n");

    // Get images
    $(
      [
        ".feed-shared-update-v2__content img",
        ".update-components-image img",
        ".feed-shared-image",
        ".feed-shared-image__container img",
      ].join(",")
    ).each((_, element) => {
      const imgSrc = $(element).attr("src");
      if (
        imgSrc &&
        !imgSrc.includes("data:image") &&
        !imgSrc.includes("ghost") &&
        !imgSrc.includes("emoji") &&
        !imgSrc.includes("profile")
      ) {
        postData.images.push(imgSrc);
      }
    });

    // Get author and date
    postData.author = $(".feed-shared-actor__name").text().trim();
    postData.date = $(".feed-shared-actor__sub-description").text().trim();

    // Validate the scraped content
    if (!postData.text.trim()) {
      throw new Error("Could not extract post content");
    }

    return res.json({
      success: true,
      post: postData,
    });
  } catch (error) {
    console.error("Error scraping post:", error);
    return res.status(500).json({
      message: "Failed to scrape LinkedIn post",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}