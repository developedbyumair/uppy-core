import express from 'express';
import companion from '@uppy/companion';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from "dotenv";
import fs from "fs";
import os from 'os';
import path from 'path';
import request from "request";
import session from "express-session";

dotenv.config();

const app = express();

// Enable CORS with specific options
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'HEAD', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(
  // @ts-ignore
  session({
    secret: "676522f38edb8239a1238cc03702dbab",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // set to true if using https
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Create temporary directory for uploads
const uploadsDir = path.join(os.tmpdir(), 'companion-uploads');

const companionOptions = {
  metrics: {
    enabled: true,
    prefix: 'companion'
  },
  server: {
    host: process.env.VERCEL_URL || 'localhost:3000',
    protocol: process.env.VERCEL_URL ? 'https' : 'http',
    path: '/companion'
  },
  secret: process.env.COMPANION_SECRET || '676522f38edb8239a1238cc03702dbab',
  debug: true,
  corsOrigins: true,
  filePath: process.env.VERCEL_URL ? '/tmp' : uploadsDir,
  streamingUpload: true,
  enableUrlEndpoint: true,
  allowedUrls: ['.*'],
  uploadUrls: ['.*'],
  maxFileSize: 100 * 1024 * 1024,
  redisUrl: process.env.REDIS_URL,
  periodicPingFrequency: 3000,
  clientSocketConnectTimeout: 60000,
  sendClientErrorMessage: true,
  uploadUrls: ['.*'],
  logClientVersion: true,
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
    drive: {
      key: process.env.COMPANION_DRIVE_KEY,
      secret: process.env.COMPANION_DRIVE_SECRET
    }
  }
};

// Initialize Companion
const { app: companionApp } = companion.app(companionOptions);

// Middleware to handle upload status
app.use((req, res, next) => {
  // Add custom headers to all responses
  res.set({
    'Access-Control-Expose-Headers': 'Upload-Status, Upload-Offset, Upload-Length',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  // For upload endpoints
  if (req.path.includes('/companion') || req.path.includes('/upload')) {
    const originalJson = res.json;
    const originalEnd = res.end;
    
    // Override json method
    res.json = function(body) {
      res.set('Upload-Status', 'completed');
      return originalJson.call(this, body);
    };
    
    // Override end method
    res.end = function(chunk, encoding) {
      res.set('Upload-Status', 'completed');
      return originalEnd.call(this, chunk, encoding);
    };
    
    // Log upload progress
    req.on('data', (chunk) => {
      console.log(`Upload progress: ${chunk.length} bytes received`);
    });

    req.on('end', () => {
      console.log('Upload request body fully received');
    });
  }
  
  next();
});

// Use Companion
app.use('/companion', companionApp);

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    error: err.message,
    status: 'error'
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

// Enable WebSocket support
const server = app.listen(5001);

companion.socket(server);

export default app;
