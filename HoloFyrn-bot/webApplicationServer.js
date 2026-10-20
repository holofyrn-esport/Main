const http = require("http");
const { timingSafeEqual } = require("crypto");
const { submitWebTryout } = require("./handlers/tryoutHandler");

const MAX_BODY_BYTES = 12_000;
let submissionQueue = Promise.resolve();

function authorized(request, expectedSecret) {
  const supplied = request.headers.authorization || "";
  const expected = `Bearer ${expectedSecret}`;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function respond(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function startWebApplicationServer(client) {
  const secret = process.env.WEB_APPLICATION_SECRET;
  if (!secret) {
    console.warn("Web application endpoint disabled: WEB_APPLICATION_SECRET is not configured.");
    return null;
  }

  const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      return respond(response, client.isReady() ? 200 : 503, { ok: client.isReady() });
    }
    if (request.method !== "POST" || request.url !== "/api/web-applications") {
      return respond(response, 404, { error: "Not found" });
    }
    if (!authorized(request, secret)) {
      return respond(response, 401, { error: "Unauthorized" });
    }
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return respond(response, 415, { error: "Content-Type must be application/json" });
    }

    let rawBody = "";
    let bodySize = 0;
    let oversized = false;
    request.on("data", chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_BYTES) {
        oversized = true;
      } else {
        rawBody += chunk;
      }
    });
    request.on("end", async () => {
      if (response.writableEnded) return;
      if (oversized) return respond(response, 413, { error: "Application is too large" });
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return respond(response, 400, { error: "Invalid JSON" });
      }
      if (!client.isReady()) {
        return respond(response, 503, { error: "Discord bot is not ready" });
      }
      try {
        const submission = submissionQueue.then(() => submitWebTryout(client, payload));
        submissionQueue = submission.catch(() => {});
        const result = await submission;
        return respond(response, 202, { ok: true, ...result });
      } catch (error) {
        console.error("Web application handoff failed:", error.message);
        const clientError = error.message.startsWith("Invalid web application");
        return respond(response, clientError ? 400 : 503, {
          error: clientError ? error.message : "Could not send the application to Discord review"
        });
      }
    });
  });

  const port = Number(process.env.WEB_APPLICATION_PORT || process.env.PORT || 3001);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Web application endpoint listening on port ${port}.`);
  });
  server.on("error", error => {
    console.error("Web application endpoint failed to start:", error.message);
  });
  return server;
}

module.exports = { startWebApplicationServer };
