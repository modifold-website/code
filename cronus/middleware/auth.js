const jwt = require("jsonwebtoken");
const { db } = require("../config/db");

const TOKEN_PREFIX_API = "mf_";

module.exports = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if(token.startsWith(TOKEN_PREFIX_API)) {
        try {
            const [rows] = await db.query(
                `SELECT user_id, expires_at, last_used_at 
                FROM api_tokens 
                WHERE token = ?`,
                [token]
            );

            if(rows.length === 0) {
                return res.status(401).json({ message: "Invalid or deleted API token" });
            }

            const apiToken = rows[0];

            if(apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
                return res.status(403).json({ message: "API token has expired" });
            }

            if(!apiToken.last_used_at || Date.now() - new Date(apiToken.last_used_at).getTime() > 5 * 60 * 1000) {
                await db.query(
                    `UPDATE api_tokens SET last_used_at = NOW() WHERE token = ?`,
                    [token]
                );
            }

            req.user = { id: apiToken.user_id, viaApiToken: true };
            return next();
        } catch (err) {
            console.error("API token check error:", err);
            return res.status(500).json({ message: "Server error during token validation" });
        }
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err) {
            return res.status(403).json({ message: "Invalid JWT token" });
        }

        req.user = { ...decoded, viaApiToken: false };
        next();
    });
};