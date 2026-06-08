const jwt = require("jsonwebtoken");
const { db } = require("../config/db");

const TOKEN_PREFIX_API = "mf_";

module.exports = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
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
                return next();
            }

            const apiToken = rows[0];

            if(apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
                return next();
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
            console.error("Optional API token check error:", err);
            return next();
        }
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err) {
            return next();
        }

        req.user = { ...decoded, viaApiToken: false };
        return next();
    });
};