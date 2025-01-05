// const port = process.env.PORT || 5000;
// app.listen(port, () => {
//   /* eslint-disable no-console */
//   console.log(`Listening: http://localhost:${port}`);
//   /* eslint-enable no-console */
// });

// import app from "./app.js";
import companion from "@uppy/companion";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import request from "request";
import bodyParser from "body-parser";
import session from "express-session";
import cors from "cors";
import cheerio from "cheerio";

dotenv.config();

// Initialize Express app
const app = express();

// CORS should be first
app.use(
  cors({
    origin: "*", // Be more specific in production
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Add CORS headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Origin, Content-Type, Accept, *"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Session configuration
app.use(
  // @ts-ignore
  session({
    secret: "676522f38edb8239a1238cc03702dbab",
    resave: true,
    saveUninitialized: true,
  })
);

// Add basic route for testing
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Add request logging
app.use((req, res, next) => {
  const start = Date.now();

  // Log request start
  console.log(
    `${req.method} ${req.path} started at ${new Date().toISOString()}`
  );

  // Track upload progress
  if (req.path.includes("/companion") || req.path.includes("/upload")) {
    req.on("data", (chunk) => {
      console.log(`Received ${chunk.length} bytes for ${req.path}`);
    });

    req.on("end", () => {
      console.log(`Request body fully received for ${req.path}`);
    });
  }

  // Add response handlers
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} completed in ${duration}ms`);

    // For upload endpoints, ensure client gets completion status
    if (req.path.includes("/companion") || req.path.includes("/upload")) {
      res.setHeader("Upload-Status", "completed");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    }
  });

  next();
});

// Error handling should be last
const errorHandler = (err, req, res, next) => {
  console.error("Error details:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    headers: req.headers,
  });

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    path: req.path,
  });
};

app.use(errorHandler);

// Create a temporary uploads directory
const uploadsDir = path.join(os.tmpdir(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Companion options
const companionOptions = {
  providerOptions: {
    unsplash: {
      key: "Wg-X31Zno-d_QVkFifC96czVe1hhUUAfTEybwNq7e2E",
      secret: "E00NcA5wx8RfwZFwgBfgtl4HZpRs0YsQ66OsTIuKTJ4",
    },
    // url: {
    //   enabled: true,
    //   companionUrl: "https://uppy-core.vercel.app",
    //   allowedOrigins: [".*"],
    //   allowedURLs: [".*"],
    // },
    url: {
      enabled: false,
      companion: false,
    },
  },
  metrics: {
    enabled: true,
    prefix: "companion",
  },
  server: {
    host: "uppy-core.vercel.app",
    protocol: "https",
  },
  secret: "676522f38edb8239a1238cc03702dbab",
  debug: true,
  corsOrigins: true,
  filePath: "/tmp", // Use /tmp for Vercel
  streamingUpload: true,
  enableUrlEndpoint: true,
  allowedUrls: [".*"],
  uploadUrls: [".*"],
  maxFileSize: 100 * 1024 * 1024, // 100MB,
  clientSocketConnectTimeout: 60000,
  actionRetryDelays: [0, 1000, 3000, 5000],
  sendClientErrorMessage: true,
};

// Initialize Companion
const { app: companionApp } = companion.app(companionOptions);

// Add upload completion handling
companionApp.on("upload-complete", (data) => {
  console.log("Upload completed:", data);
});

app.use(companionApp);

// Error handler with detailed logging
app.use((err, req, res, next) => {
  console.error("Error occurred:", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });

  res.status(err.status || 500).json({
    message: err.message,
    status: "error",
  });
});

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
app.get("/", async (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  const response = await fetch("https://example.com");
  const html = await response.text();
  console.log("html", html);
  res.send("Hello there, here's a response from companion");
});
// Enable WebSocket support
const server = app.listen(5001);

companion.socket(server);

export default app;
