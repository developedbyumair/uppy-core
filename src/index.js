// const port = process.env.PORT || 5000;
// app.listen(port, () => {
//   /* eslint-disable no-console */
//   console.log(`Listening: http://localhost:${port}`);
//   /* eslint-enable no-console */
// });

// import app from "./app.js";
import express from "express";
import bodyParser from "body-parser";
import companion from "@uppy/companion";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import request from "request";

dotenv.config();

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Middleware for parsing JSON and handling CORS
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Origin, Content-Type, Accept"
  );
  next();
});

// Create a temporary uploads directory
const uploadsDir = path.join(os.tmpdir(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Uploads directory created at:", uploadsDir);
}

console.log(uploadsDir);

// Companion options
const companionOptions = {
  providerOptions: {
    unsplash: {
      key: "Wg-X31Zno-d_QVkFifC96czVe1hhUUAfTEybwNq7e2E",
      secret: "E00NcA5wx8RfwZFwgBfgtl4HZpRs0YsQ66OsTIuKTJ4",
    },
    url: {
      enabled: true,
      companion: true,
    },
  },
  server: {
    host: "uppy-core.vercel.app",
    protocol: "https",
  },
  secret: "676522f38edb8239a1238cc03702dbab",
  debug: true,
  corsOrigins: true,
  filePath: uploadsDir,
  streamingUpload: true,
  allowLocalUrls: true,
  uploadUrls: {
    // This should point to the temporary uploads directory
    url: uploadsDir,
  },
  enableUrlEndpoint: true,
};

//   secret: String(process.env.COMPANION_SECRET || "some-secret"),
//   server: {
//     host: "uppy-companion-express.vercel.app",
//     protocol: "https",
//     // path: "/companion",
//   },
//   providerOptions: {
//     dropbox: {
//       key: String(process.env.DROPBOX_KEY),
//       secret: String(process.env.DROPBOX_SECRET),
//     },
//     unsplash: {
//       key: String(process.env.UNSPLASH_KEY),
//       secret: String(process.env.UNSPLASH_SECRET),
//     },
//     url: {
//       enabled: true,
//       companion: true,
//     },
//   },
//   filePath: uploadsDir,
//   debug: true,
//   corsOrigins: true,
//   streamingUpload: true,
//   allowLocalUrls: true,
//   enableUrlEndpoint: true,
// };

// Initialize Companion
const { app: companionApp } = companion.app(companionOptions);

app.use(companionApp);

// Meta endpoint
app.post("/url/meta", (req, res) => {
  console.log("Received URL meta request:", req.body);
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Make a HEAD request to get file info
    request.head(url, (err, response) => {
      if (err) {
        console.error("Error getting file metadata:", err);
        return res.status(500).json({ error: "Failed to get file metadata" });
      }

      const contentLength = response.headers["content-length"];
      const contentType = response.headers["content-type"];
      const fileName = url.split("/").pop() || "downloaded-file";

      return res.json({
        type: contentType,
        name: fileName,
        size: parseInt(contentLength, 10),
        meta: {
          url: url,
          type: contentType,
        },
      });
    });
  } catch (error) {
    console.error("Error processing URL meta:", error);
    res.status(500).json({ error: error.message });
  }
});

// Download endpoint
app.post("/url/get", (req, res) => {
  console.log("Received URL download request:", req.body);
  try {
    const { url, metadata } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Set appropriate headers
    res.setHeader("Content-Type", metadata?.type || "application/octet-stream");
    if (metadata?.size) {
      res.setHeader("Content-Length", metadata.size);
    }

    // Stream the file
    request(url)
      .on("error", (err) => {
        console.error("Error downloading file:", err);
        res.status(500).json({ error: "Failed to download file" });
      })
      .on("response", (response) => {
        // Copy headers from the remote response
        Object.keys(response.headers).forEach((key) => {
          res.setHeader(key, response.headers[key]);
        });
      })
      .pipe(res);
  } catch (error) {
    console.error("Error processing URL download:", error);
    res.status(500).json({ error: error.message });
  }
});

// Enable WebSocket support
const server = app.listen(5000);

companion.socket(server);
