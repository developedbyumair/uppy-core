// @ts-nocheck
import puppeteer from "puppeteer";

/**
 * Headless-browser fallback. Launches Chromium, opens the user profile on X,
 * waits for the initial tweets to render, then extracts tweet text + media
 * from the DOM. Slower and heavier than other methods, so use only when
 * everything else fails.
 *
 * @param {string} username  without the @
 * @param {number} [limit=10]
 * @returns {Promise<Array<{id:string,text:string,date:string,images:string[],videos:string[]}>>}
 */
export async function fetchTweetsHeadless(username, limit = 10) {
  if (!username) throw new Error("username required");
  limit = Math.max(1, Math.min(limit, 50));

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );

  const url = `https://x.com/${encodeURIComponent(username)}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

  // Scroll a bit to ensure tweets load (especially images)
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
  // puppeteer v22 removed Page.waitForTimeout; use manual sleep instead
  await new Promise((res) => setTimeout(res, 2000));

  /** @type {{[id:string]:any}} */
  const collected = {};

  const extractTweets = async () => {
    return /** @type {any[]} */ (
      await page.evaluate(() => {
        const arr = [];
        const arts = document.querySelectorAll('article[role="article"]');
        arts.forEach((art) => {
          const timeLink =
            art.querySelector("a time")?.parentElement?.getAttribute("href") ||
            "";
          const id = timeLink.split("/").pop() || "";
          if (!id) return;
          let text = "";
          art.querySelectorAll('[data-testid="tweetText"]').forEach((n) => {
            text += (n.textContent || "") + "\n";
          });
          text = text.trim();
          const date =
            art.querySelector("time")?.getAttribute("datetime") || "";
          const images = [];
          const videos = [];

          // Heuristics for "this tweet is part of a thread":
          // 1) X sometimes renders a span with "Show this thread" around the tweet
          const hasShowThread = Array.from(art.querySelectorAll("span")).some(
            (el) => /show (this )?thread/i.test(el.textContent || "")
          );

          // 2) Authors often prefix numbered threads: "1/", "1 / 5", "2/10" etc.
          const numbered = /^\s*\d+\s*\/?\s*\d*/.test(text);

          // 3) Presence of the thread emoji 🧵 or the word "Thread:" in the first words
          const hasEmoji = /🧵/.test(text);
          const wordThread = /^thread[:\s]/i.test(text.trim());

          const isThread = hasShowThread || numbered || hasEmoji || wordThread;

          art
            .querySelectorAll('img[src*="twimg.com/media/"]')
            .forEach((img) => {
              const src = img.getAttribute("src");
              if (src && !images.includes(src)) images.push(src);
            });
          art.querySelectorAll("video").forEach((v) => {
            const poster = v.getAttribute("poster");
            if (poster && !videos.includes(poster)) videos.push(poster);
          });
          arr.push({ id, text, date, images, videos, thread_post: isThread });
        });
        return arr;
      })
    );
  };

  let attempts = 0;
  while (Object.keys(collected).length < limit && attempts < 10) {
    const batch = await extractTweets();
    batch.forEach((t) => {
      if (t.id && !collected[t.id]) collected[t.id] = t;
    });
    if (Object.keys(collected).length >= limit) break;
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await new Promise((r) => setTimeout(r, 1500));
    attempts += 1;
  }

  await browser.close();
  return Object.values(collected).slice(0, limit);
}
