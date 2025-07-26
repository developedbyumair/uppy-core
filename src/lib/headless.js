// @ts-nocheck
import chromium from '@sparticuz/chromium-min';
import puppeteer, { Browser as PuppeteerBrowser } from 'puppeteer';
import puppeteerCore, { Browser as PuppeteerCoreBrowser } from 'puppeteer-core';

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

  let browser = null;
  const isDevelopment = process.env.NODE_ENV === 'development';

  try {
    if (isDevelopment) {
      // Use regular Puppeteer for local development
      console.log('Launching Puppeteer for development');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } else {
      // Use Chromium-min for serverless environment (Vercel)
      console.log('Launching Puppeteer Core with Chromium-min for production');

      try {
        // Use the chromium executable path with explicit download URL
        const executablePath = await chromium.executablePath(
          'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
        );

        console.log('Using chromium executable with explicit URL:', executablePath);

        browser = await puppeteerCore.launch({
          executablePath,
          args: [...chromium.args, '--no-sandbox'],
          headless: chromium.headless,
          defaultViewport: chromium.defaultViewport,
        });

        console.log('Browser launched successfully with Chromium-min');
      } catch (chromiumError) {
        console.error('Failed to launch browser with explicit URL, trying with /tmp path:', chromiumError);

        // First fallback - try with /tmp path
        try {
          const tmpExecutablePath = await chromium.executablePath('/tmp');
          console.log('Using chromium executable with /tmp path:', tmpExecutablePath);

          browser = await puppeteerCore.launch({
            executablePath: tmpExecutablePath,
            args: [...chromium.args, '--no-sandbox'],
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport,
          });

          console.log('Browser launched successfully with /tmp path');
        } catch (tmpError) {
          console.error('Failed to launch browser with /tmp path, trying environment variable:', tmpError);

          // Second fallback - try with environment variable or default path
          try {
            browser = await puppeteerCore.launch({
              executablePath:
                process.env.PUPPETEER_EXECUTABLE_PATH ||
                (await chromium.executablePath()),
              args: [...chromium.args, '--no-sandbox'],
              headless: true,
            });

            console.log('Browser launched successfully with environment variable');
          } catch (fallbackError) {
            console.error('Failed to launch browser with all fallback approaches:', fallbackError);
            throw fallbackError;
          }
        }
      }
    }

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

    return Object.values(collected).slice(0, limit);
  } catch (error) {
    console.error('Error in fetchTweetsHeadless:', error);
    throw error;
  } finally {
    // Always close browser in finally block
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}
