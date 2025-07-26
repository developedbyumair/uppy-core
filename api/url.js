import request from "request";

export default function handler(req, res) {
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

  const { url: requestPath } = req.query;
  
  // Handle /url/meta endpoint
  if (requestPath && requestPath[0] === "meta") {
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
  }
  
  // Handle /url/get endpoint
  else if (requestPath && requestPath[0] === "get") {
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
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Upload-Status", "completed");

      // Stream the file
      request(url)
        .on("error", (err) => {
          console.error("Error downloading file:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        })
        .on("response", (response) => {
          // Copy headers from the remote response
          Object.keys(response.headers).forEach((key) => {
            if (!res.headersSent) {
              res.setHeader(key, response.headers[key]);
            }
          });
        })
        .pipe(res);
    } catch (error) {
      console.error("Error processing URL download:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  } else {
    res.status(404).json({ error: "Endpoint not found" });
  }
}