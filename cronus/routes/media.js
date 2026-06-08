const express = require("express");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { sanitizeExternalUrl } = require("../utils/sanitize");

const router = express.Router();

router.get("/markdown-image", async (req, res) => {
    const targetUrl = sanitizeExternalUrl(req.query?.url);

    if(!targetUrl) {
        return res.status(400).json({ error: "invalid_image_url" });
    }

    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(targetUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const upstream = await fetch(proxyUrl, {
            headers: {
                Accept: "image/*",
                "User-Agent": "ModifoldMediaProxy/1.0",
            },
            signal: controller.signal,
        });

        if(!upstream.ok) {
            return res.status(upstream.status).json({ error: "image_proxy_failed" });
        }

        const contentType = upstream.headers.get("content-type") || "";
        if(!contentType.toLowerCase().startsWith("image/")) {
            return res.status(415).json({ error: "unsupported_content_type" });
        }

        const cacheControl = upstream.headers.get("cache-control");
        if(cacheControl) {
            res.setHeader("Cache-Control", cacheControl);
        } else {
            res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
        }

        const etag = upstream.headers.get("etag");
        if(etag) {
            res.setHeader("ETag", etag);
        }

        const lastModified = upstream.headers.get("last-modified");
        if(lastModified) {
            res.setHeader("Last-Modified", lastModified);
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader("X-Content-Type-Options", "nosniff");

        if(!upstream.body) {
            return res.status(502).json({ error: "image_proxy_unavailable" });
        }

        const bodyStream = Readable.fromWeb(upstream.body);
        await pipeline(bodyStream, res);
        return;
    } catch (error) {
        const statusCode = error?.name === "AbortError" ? 504 : 502;
        return res.status(statusCode).json({ error: "image_proxy_unavailable" });
    } finally {
        clearTimeout(timeout);
    }
});

module.exports = router;