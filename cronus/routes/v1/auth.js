const express = require("express");
const jwt = require("jsonwebtoken");
const { db } = require("../../config/db");
const slugify = require("slugify");
const crypto = require("crypto");
const axios = require("axios");
const { authenticator } = require("otplib");
const { sendMail } = require("../../utils/smtpMailer");
const router = express.Router();
const auth = require("../../middleware/auth");
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const BCRYPT_COST = 12;

authenticator.options = { window: 1 };

const getTwoFactorRow = async (userId) => {
    const [rows] = await db.query("SELECT secret, enabled FROM user_two_factor WHERE user_id = ? LIMIT 1", [userId]);
    return rows[0] || null;
};

const isTwoFactorEnabled = (row) => Boolean(row && row.enabled === 1 && row.secret);

const issueTwoFactorToken = (userId) => jwt.sign({ id: userId, type: "2fa" }, process.env.JWT_SECRET, { expiresIn: "10m" });

function normalizeReturnPath(nextPath) {
    if(typeof nextPath !== "string") {
        return "/";
    }

    if(!nextPath.startsWith("/") || nextPath.startsWith("//")) {
        return "/";
    }

    return nextPath;
}

const generateRandomSlug = () => Array.from({ length: 10 }, () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    return chars.charAt(Math.floor(Math.random() * chars.length));
}).join("");

const buildSlugBase = (value) => {
    const baseSlug = slugify(value, { lower: true });
    if(baseSlug) {
        return { baseSlug, useRandomFallback: false };
    }

    return { baseSlug: generateRandomSlug(), useRandomFallback: true };
};

async function createUniqueSlug(value, fallbackId = null) {
    const { baseSlug, useRandomFallback } = buildSlugBase(value);
    let slug = baseSlug;
    let attempts = 0;
    const maxAttempts = 10;

    while(attempts < maxAttempts) {
        const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ? LIMIT 1", [slug]);

        if(existingSlug.length === 0) {
            return slug;
        }

        if(useRandomFallback) {
            slug = generateRandomSlug();
        } else {
            const randomNum = Math.floor(Math.random() * 10000) + 1;
            slug = `${baseSlug}-${randomNum}`;
        }

        attempts++;
    }

    if(fallbackId) {
        const fallbackSlug = `id${fallbackId}`;
        const [existingFallbackSlug] = await db.query("SELECT id FROM users WHERE slug = ? LIMIT 1", [fallbackSlug]);
        if(existingFallbackSlug.length === 0) {
            return fallbackSlug;
        }
    }

    return generateRandomSlug();
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function normalizeCode(code) {
    return String(code || "").replace(/\D/g, "").slice(0, 6);
}

function hashEmailCode(email, code) {
    return crypto.createHash("sha256").update(`${normalizeEmail(email)}:${code}:${process.env.JWT_SECRET}`).digest("hex");
}

function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validatePassword(password) {
    if(typeof password !== "string" || password.length < 8) {
        return "Password must be at least 8 characters long";
    }

    return null;
}

async function verifyHCaptcha(token, remoteIp) {
    if(!process.env.HCAPTCHA_SECRET) {
        throw new Error("HCAPTCHA_SECRET is not configured");
    }

    if(!process.env.HCAPTCHA_SITE_KEY) {
        throw new Error("HCAPTCHA_SITE_KEY is not configured");
    }

    const params = new URLSearchParams({
        secret: process.env.HCAPTCHA_SECRET,
        response: token || "",
        sitekey: process.env.HCAPTCHA_SITE_KEY,
    });

    if(remoteIp) {
        params.set("remoteip", remoteIp);
    }

    const response = await axios.post("https://api.hcaptcha.com/siteverify", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return response.data?.success === true;
}

function buildEmailVerificationHtml(code) {
    const digits = code.split("").map((digit) => `
        <td style="width:44px;height:52px;border-radius:12px;background:#f5f5f5;border:1px solid #ececec;text-align:center;font-size:28px;line-height:52px;font-weight:700;color:#000000;font-family:Inter,Arial,sans-serif;">${digit}</td>
    `).join("");

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Modifold verification code</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;color:#172033;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#dfdfdf;padding:32px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;">
                    <tr>
                        <td style="padding:30px 32px 18px;text-align:center;background:#f5f5f5;">
                            <img
                                src="https://media.modifold.com/static/email-logo.png"
                                width="48"
                                height="48"
                                alt="Modifold"
                                style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;"
                            >
                            <h1 style="margin:18px 0 8px;font-size:26px;line-height:32px;color:#000000;">Confirm your email</h1>
                            <p style="margin:0;color:#595959;font-size:15px;line-height:22px;">Your code to create a Modifold account</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;text-align:center;">
                            <p style="margin:0 0 22px;color:#000000;font-size:16px;line-height:24px;">Enter this code in the registration window. It is valid for 5 minutes.</p>
                            <table role="presentation" cellspacing="8" cellpadding="0" align="center" style="margin:0 auto 24px;">
                                <tr>${digits}</tr>
                            </table>
                            <p style="margin:0;color:#595959;font-size:13px;line-height:20px;">If you did not create a Modifold account, you can safely ignore this email.</p>
                        </td>
                    </tr>
                </table>
                <p style="margin:18px 0 0;color:#595959;font-size:12px;line-height:18px;">Modifold • no-reply@modifold.com</p>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

async function hashPassword(password) {
    if(!globalThis.Bun?.password?.hash) {
        throw new Error("Bun password hashing API is not available");
    }

    return Bun.password.hash(password, {
        algorithm: "bcrypt",
        cost: BCRYPT_COST,
    });
}

async function verifyPassword(password, hash) {
    if(!globalThis.Bun?.password?.verify) {
        throw new Error("Bun password verify API is not available");
    }

    return Bun.password.verify(password, hash);
}

function redirectToFrontendAuth(res, params) {
    const hash = new URLSearchParams(params).toString();
    return res.redirect(`https://modifold.com/auth/callback#${hash}`);
}

function verifyTelegramData(data, botToken) {
    const secret = crypto.createHash("sha256").update(botToken).digest();
    const checkString = Object.keys(data).filter((key) => key !== "hash").sort().map((key) => `${key}=${data[key]}`).join("\n");
    const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

    return hmac === data.hash;
}

router.post("/email-login", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if(!isEmail(email) || typeof password !== "string") {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    try {
        const [users] = await db.query("SELECT id, username, slug, password_hash FROM users WHERE email_login_key = ? LIMIT 1", [email]);
        const user = users[0];

        if(!user?.password_hash) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const passwordMatches = await verifyPassword(password, user.password_hash);
        if(!passwordMatches) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const twoFactorRow = await getTwoFactorRow(user.id);
        if(isTwoFactorEnabled(twoFactorRow)) {
            const twoFactorToken = issueTwoFactorToken(user.id);
            return res.json({ twoFactorRequired: true, twoFactorToken, success: true });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ token, user: { id: user.id, username: user.username, slug: user.slug }, success: true });
    } catch (error) {
        console.error("Email Login Error:", {
            message: error?.message || "unknown error",
            stack: error?.stack || null,
            email,
        });
        res.status(500).json({ success: false, message: "Error during email authorization" });
    }
});

router.post("/email-register/start", async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const hcaptchaToken = req.body?.hcaptchaToken;

    if(username.length < 2 || username.length > 100) {
        return res.status(400).json({ success: false, message: "Username must be between 2 and 100 characters" });
    }

    if(!isEmail(email)) {
        return res.status(400).json({ success: false, message: "Valid email is required" });
    }

    const passwordError = validatePassword(password);
    if(passwordError) {
        return res.status(400).json({ success: false, message: passwordError });
    }

    if(!hcaptchaToken) {
        return res.status(400).json({ success: false, message: "Captcha is required" });
    }

    try {
        const captchaValid = await verifyHCaptcha(hcaptchaToken, req.ip);
        if(!captchaValid) {
            return res.status(400).json({ success: false, message: "Captcha verification failed" });
        }

        const [existingEmail] = await db.query("SELECT id FROM users WHERE email_login_key = ? LIMIT 1", [email]);
        if(existingEmail.length > 0) {
            return res.status(409).json({ success: false, message: "Email is already registered" });
        }

        const code = String(crypto.randomInt(100000, 1000000));
        const codeHash = hashEmailCode(email, code);
        const passwordHash = await hashPassword(password);
        const now = Date.now();
        const expiresAt = now + EMAIL_CODE_TTL_MS;

        await db.query("DELETE FROM email_auth_verifications WHERE email = ? OR expires_at < ?", [email, now]);
        await db.query(
            "INSERT INTO email_auth_verifications (email, username, password_hash, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [email, username, passwordHash, codeHash, expiresAt, now]
        );

        await sendMail({
            to: email,
            subject: "Your Modifold verification code",
            text: `Your Modifold verification code is ${code}. It is valid for 5 minutes.`,
            html: buildEmailVerificationHtml(code),
        });

        res.json({ success: true, expiresIn: Math.floor(EMAIL_CODE_TTL_MS / 1000) });
    } catch (error) {
        console.error("Email Register Start Error:", {
            message: error?.message || "unknown error",
            stack: error?.stack || null,
            email,
        });
        res.status(500).json({ success: false, message: "Error starting email registration" });
    }
});

router.post("/email-register/confirm", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = normalizeCode(req.body?.code);
    const now = Date.now();

    if(!isEmail(email) || code.length !== 6) {
        return res.status(400).json({ success: false, message: "Email and 6-digit code are required" });
    }

    try {
        const [rows] = await db.query(
            "SELECT id, username, password_hash, code_hash, expires_at, attempts FROM email_auth_verifications WHERE email = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1",
            [email]
        );
        const verification = rows[0];

        if(!verification || Number(verification.expires_at) < now) {
            return res.status(400).json({ success: false, message: "Code is expired" });
        }

        if(Number(verification.attempts) >= EMAIL_CODE_MAX_ATTEMPTS) {
            return res.status(429).json({ success: false, message: "Too many code attempts" });
        }

        const expectedHash = hashEmailCode(email, code);
        if(expectedHash !== verification.code_hash) {
            await db.query("UPDATE email_auth_verifications SET attempts = attempts + 1 WHERE id = ?", [verification.id]);
            return res.status(400).json({ success: false, message: "Invalid code" });
        }

        const [existingEmail] = await db.query("SELECT id FROM users WHERE email_login_key = ? LIMIT 1", [email]);
        if(existingEmail.length > 0) {
            await db.query("UPDATE email_auth_verifications SET used_at = ? WHERE id = ?", [now, verification.id]);
            return res.status(409).json({ success: false, message: "Email is already registered" });
        }

        const slug = await createUniqueSlug(verification.username);
        const [result] = await db.query(
            "INSERT INTO users (username, slug, email, email_login_key, password_hash, email_verified_at, created_at, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [verification.username, slug, email, email, verification.password_hash, now, now, "https://modifold.com/images/user/default_ava.png"]
        );

        await db.query("UPDATE email_auth_verifications SET used_at = ? WHERE id = ?", [now, verification.id]);

        const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ token, user: { id: result.insertId, username: verification.username, slug }, success: true });
    } catch (error) {
        console.error("Email Register Confirm Error:", {
            message: error?.message || "unknown error",
            stack: error?.stack || null,
            email,
        });
        res.status(500).json({ success: false, message: "Error confirming email registration" });
    }
});

router.post("/discord-login", async (req, res) => {
    const { code } = req.body;

    try {
        const tokenResponse = await axios.post(
            "https://discord.com/api/oauth2/token",
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: `https://api.modifold.com/auth/discord-callback`,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        const { access_token } = tokenResponse.data;
        if(!access_token) {
            return res.status(401).json({ success: false, message: "Unable to obtain Discord access token" });
        }

        const userResponse = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const { id: discordId, username, discriminator, avatar, email } = userResponse.data;

        const [existingUser] = await db.query("SELECT id, username, slug FROM users WHERE discord_id = ?", [discordId]);
        let user = existingUser[0];

        if(user) {
            const twoFactorRow = await getTwoFactorRow(user.id);
            if(isTwoFactorEnabled(twoFactorRow)) {
                const twoFactorToken = issueTwoFactorToken(user.id);
                return res.json({ twoFactorRequired: true, twoFactorToken, success: true });
            }

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
            return res.json({ token, user: { id: user.id, username: user.username, slug: user.slug }, success: true });
        }

        const displayName = discriminator === "0" ? username : `${username}#${discriminator}`;
        const { baseSlug, useRandomFallback } = buildSlugBase(displayName);
        let slug = baseSlug;
        let slugIsUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while(!slugIsUnique && attempts < maxAttempts) {
            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);

            if(existingSlug.length > 0) {
                if(useRandomFallback) {
                    slug = generateRandomSlug();
                } else {
                    const randomNum = Math.floor(Math.random() * 10000) + 1;
                    slug = `${baseSlug}-${randomNum}`;
                }
                attempts++;
            } else {
                slugIsUnique = true;
            }
        }

        if(!slugIsUnique) {
            slug = `id${discordId}`;
            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
            if(existingSlug.length > 0) {
                throw new Error("Unable to generate a unique slug, including fallback");
            }
        }

        const createdAt = Date.now();
        const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png` : "https://modifold.com/images/user/default_ava.png";

        const [result] = await db.query(
            "INSERT INTO users (username, slug, discord_id, email, created_at, avatar) VALUES (?, ?, ?, ?, ?, ?)",
            [displayName, slug, discordId, email, createdAt, avatarUrl]
        );

        const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ token, user: { id: result.insertId, username: displayName, slug }, success: true });
    } catch (error) {
        console.error("Discord Login Error:", error);
        res.status(500).json({ success: false, message: "Error during authorization via Discord" });
    }
});

router.get("/discord-callback", async (req, res) => {
    const { code } = req.query;
    const nextPath = normalizeReturnPath(req.query.state);

    try {
        if(!code) {
            console.error("No code provided in Discord callback");
            return redirectToFrontendAuth(res, { error: "No code provided", next: nextPath });
        }

        const tokenResponse = await axios.post(
            "https://discord.com/api/oauth2/token",
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: `https://api.modifold.com/auth/discord-callback`,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        const { access_token, error, error_description } = tokenResponse.data;
        if(error) {
            console.error("Discord token error:", error, error_description);

            return redirectToFrontendAuth(res, { error: error_description || "Unable to obtain Discord access token", next: nextPath });
        }

        if(!access_token) {
            console.error("No access token received");

            return redirectToFrontendAuth(res, { error: "Unable to obtain Discord access token", next: nextPath });
        }

        const userResponse = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const { id: discordId, username, discriminator, avatar, email } = userResponse.data;

        const [existingUser] = await db.query("SELECT id, username, slug FROM users WHERE discord_id = ?", [discordId]);
        let user = existingUser[0];

        if(!user) {
            const displayName = discriminator === "0" ? username : `${username}#${discriminator}`;
            const { baseSlug, useRandomFallback } = buildSlugBase(displayName);
            let slug = baseSlug;

            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
            if(existingSlug.length > 0) {
                if(useRandomFallback) {
                    slug = generateRandomSlug();
                } else {
                    const randomNum = Math.floor(Math.random() * 10000) + 1;
                    slug = `${baseSlug}-${randomNum}`;
                }

                const [existingRandomSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
                if(existingRandomSlug.length > 0) {
                    slug = `id${discordId}`;
                    const [existingFallbackSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
                    if(existingFallbackSlug.length > 0) {
                        throw new Error("Unable to generate a unique slug, including fallback");
                    }
                }
            }

            const createdAt = Date.now();
            const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png` : "https://modifold.com/images/user/default_ava.png";

            const [result] = await db.query(
                "INSERT INTO users (username, slug, discord_id, email, created_at, avatar) VALUES (?, ?, ?, ?, ?, ?)",
                [displayName, slug, discordId, email, createdAt, avatarUrl]
            );

            user = { id: result.insertId, username: displayName, slug };
        }

        const twoFactorRow = await getTwoFactorRow(user.id);
        if(isTwoFactorEnabled(twoFactorRow)) {
            const twoFactorToken = issueTwoFactorToken(user.id);
            return redirectToFrontendAuth(res, { twofactor: "1", twofactor_token: twoFactorToken, next: nextPath });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
        return redirectToFrontendAuth(res, { token, next: nextPath });
    } catch (error) {
        console.error("Discord Callback Error:", error.message, error.stack);
        return redirectToFrontendAuth(res, { error: error.message || "Error processing Discord callback", next: nextPath });
    }
});

router.get("/telegram-callback", async (req, res) => {
    const telegramData = { ...req.query };
    const nextPath = normalizeReturnPath(telegramData.next);
    delete telegramData.next;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if(!verifyTelegramData(telegramData, botToken)) {
        console.error("Telegram Callback Error: invalid signature", {
            telegram_id: telegramData?.id || null,
            auth_date: telegramData?.auth_date || null,
        });
        return redirectToFrontendAuth(res, { error: "Telegram signature is invalid", next: nextPath });
    }

    const { id: telegramId, first_name, last_name, photo_url } = telegramData;

    try {
        const [existingUser] = await db.query("SELECT id, username, slug FROM users WHERE telegram_id = ?", [telegramId]);
        let user = existingUser[0];

        if(!user) {
            const username = `${first_name}${last_name ? ` ${last_name}` : ""}`;
            const { baseSlug, useRandomFallback } = buildSlugBase(username);
            let slug = baseSlug;
            let slugIsUnique = false;
            let attempts = 0;
            const maxAttempts = 10;

            while(!slugIsUnique && attempts < maxAttempts) {
                const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);

                if(existingSlug.length > 0) {
                    if(useRandomFallback) {
                        slug = generateRandomSlug();
                    } else {
                        const randomNum = Math.floor(Math.random() * 10000) + 1;
                        slug = `${baseSlug}-${randomNum}`;
                    }
                    attempts++;
                } else {
                    slugIsUnique = true;
                }
            }

            if(!slugIsUnique) {
                slug = `id${telegramId}`;
                const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
                if(existingSlug.length > 0) {
                    throw new Error("Unable to generate a unique slug, including fallback");
                }
            }

            const createdAt = Date.now();
            const avatar = photo_url || "https://modifold.com/images/user/default_ava.png";

            const [result] = await db.query("INSERT INTO users (username, slug, telegram_id, created_at, avatar) VALUES (?, ?, ?, ?, ?)", [username, slug, telegramId, createdAt, avatar]);
            user = { id: result.insertId, username, slug };
        }

        const twoFactorRow = await getTwoFactorRow(user.id);
        if(isTwoFactorEnabled(twoFactorRow)) {
            const twoFactorToken = issueTwoFactorToken(user.id);
            return redirectToFrontendAuth(res, { twofactor: "1", twofactor_token: twoFactorToken, next: nextPath });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
        return redirectToFrontendAuth(res, { token, next: nextPath });
    } catch (error) {
        console.error("Telegram Callback Error:", {
            message: error?.message || "unknown error",
            stack: error?.stack || null,
            telegram_id: telegramId || null,
        });
        return redirectToFrontendAuth(res, { error: error.message || "Error processing Telegram callback", next: nextPath });
    }
});

router.post("/telegram-login", async (req, res) => {
    const telegramData = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if(!verifyTelegramData(telegramData, botToken)) {
        console.error("Telegram Login Error: invalid signature", {
            telegram_id: telegramData?.id || null,
            auth_date: telegramData?.auth_date || null,
        });
        return res.status(401).json({ success: false, message: "Telegram signature is invalid" });
    }

    const { id: telegramId, first_name, last_name, photo_url } = telegramData;

    try {
        const [existingUser] = await db.query("SELECT id, username, slug FROM users WHERE telegram_id = ?", [telegramId]);
        let user = existingUser[0];

        if(user) {
            const twoFactorRow = await getTwoFactorRow(user.id);
            if(isTwoFactorEnabled(twoFactorRow)) {
                const twoFactorToken = issueTwoFactorToken(user.id);
                return res.json({ twoFactorRequired: true, twoFactorToken, success: true });
            }

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
            return res.json({ token, user: { id: user.id, username: user.username, slug: user.slug }, success: true });
        }

        const username = `${first_name}${last_name ? ` ${last_name}` : ""}`;
        const { baseSlug, useRandomFallback } = buildSlugBase(username);
        let slug = baseSlug;
        let slugIsUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while(!slugIsUnique && attempts < maxAttempts) {
            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);

            if(existingSlug.length > 0) {
                if(useRandomFallback) {
                    slug = generateRandomSlug();
                } else {
                    const randomNum = Math.floor(Math.random() * 10000) + 1;
                    slug = `${baseSlug}-${randomNum}`;
                }
                attempts++;
            } else {
                slugIsUnique = true;
            }
        }

        if(!slugIsUnique) {
            slug = `id${telegramId}`;
            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
            if(existingSlug.length > 0) {
                throw new Error("Unable to generate a unique slug, including fallback");
            }
        }

        const createdAt = Date.now();
        const avatar = photo_url || "https://modifold.com/images/user/default_ava.png";

        const [result] = await db.query("INSERT INTO users (username, slug, telegram_id, created_at, avatar) VALUES (?, ?, ?, ?, ?)", [username, slug, telegramId, createdAt, avatar]);

        const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ token, user: { id: result.insertId, username, slug }, success: true });
    } catch (error) {
        console.error("Telegram Login Error:", {
            message: error?.message || "unknown error",
            stack: error?.stack || null,
            telegram_id: telegramId || null,
        });
        res.status(500).json({ success: false, message: "Error during authorization via Telegram" });
    }
});

router.post("/github-login", async (req, res) => {
    const { code } = req.body;

    try {
        const tokenResponse = await axios.post(
            "https://github.com/login/oauth/access_token",
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            },
            {
                headers: { Accept: "application/json" },
            }
        );

        const { access_token } = tokenResponse.data;
        if(!access_token) {
            return res.status(401).json({ success: false, message: "Unable to obtain GitHub access token" });
        }

        const userResponse = await axios.get("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const { id: githubId, login: username, name, avatar_url } = userResponse.data;

        const emailResponse = await axios.get("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const email = emailResponse.data.find((e) => e.primary)?.email || null;

        const [existingUser] = await db.query("SELECT id, username, slug FROM users WHERE github_id = ?", [githubId]);
        let user = existingUser[0];

        if(user) {
            const twoFactorRow = await getTwoFactorRow(user.id);
            if(isTwoFactorEnabled(twoFactorRow)) {
                const twoFactorToken = issueTwoFactorToken(user.id);
                return res.json({ twoFactorRequired: true, twoFactorToken, success: true });
            }

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
            return res.json({ token, user: { id: user.id, username: user.username, slug: user.slug }, success: true });
        }

        const displayName = name || username;
        const { baseSlug, useRandomFallback } = buildSlugBase(displayName);
        let slug = baseSlug;
        let slugIsUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while(!slugIsUnique && attempts < maxAttempts) {
            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);

            if(existingSlug.length > 0) {
                if(useRandomFallback) {
                    slug = generateRandomSlug();
                } else {
                    const randomNum = Math.floor(Math.random() * 10000) + 1;
                    slug = `${baseSlug}-${randomNum}`;
                }
                attempts++;
            } else {
                slugIsUnique = true;
            }
        }

        if(!slugIsUnique) {
            slug = `id${githubId}`;
            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
            if(existingSlug.length > 0) {
                throw new Error("Unable to generate a unique slug, including fallback");
            }
        }

        const createdAt = Date.now();
        const avatar = avatar_url || "https://modifold.com/images/user/default_ava.png";

        const [result] = await db.query("INSERT INTO users (username, slug, github_id, email, created_at, avatar) VALUES (?, ?, ?, ?, ?, ?)", [displayName, slug, githubId, email, createdAt, avatar]);

        const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ token, user: { id: result.insertId, username: displayName, slug }, success: true });
    } catch (error) {
        console.error("GitHub Login Error:", error);
        res.status(500).json({ success: false, message: "Error during authorization via GitHub" });
    }
});

router.get("/github-callback", async (req, res) => {
    const { code } = req.query;
    const nextPath = normalizeReturnPath(req.query.state);

    try {
        if(!code) {
            console.error("No code provided in GitHub callback");
            return redirectToFrontendAuth(res, { error: "No code provided", next: nextPath });
        }

        const tokenResponse = await axios.post(
            "https://github.com/login/oauth/access_token",
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            },
            {
                headers: { Accept: "application/json" },
            }
        );

        const { access_token, error, error_description } = tokenResponse.data;
        if(error) {
            console.error("GitHub token error:", error, error_description);
            return redirectToFrontendAuth(res, { error: error_description || "Unable to obtain GitHub access token", next: nextPath });
        }

        if(!access_token) {
            console.error("No access token received");
            return redirectToFrontendAuth(res, { error: "Unable to obtain GitHub access token", next: nextPath });
        }

        const userResponse = await axios.get("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const { id: githubId, login: username, name, avatar_url } = userResponse.data;

        const emailResponse = await axios.get("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const email = emailResponse.data.find((e) => e.primary)?.email || null;

        const [existingUser] = await db.query("SELECT id, username, slug FROM users WHERE github_id = ?", [githubId]);

        let user = existingUser[0];

        if(!user) {
            const displayName = name || username;
            const { baseSlug, useRandomFallback } = buildSlugBase(displayName);
            let slug = baseSlug;

            const [existingSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
            if(existingSlug.length > 0) {
                if(useRandomFallback) {
                    slug = generateRandomSlug();
                } else {
                    const randomNum = Math.floor(Math.random() * 10000) + 1;
                    slug = `${baseSlug}-${randomNum}`;
                }

                const [existingRandomSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
                if(existingRandomSlug.length > 0) {
                    slug = `id${githubId}`;
                    const [existingFallbackSlug] = await db.query("SELECT id FROM users WHERE slug = ?", [slug]);
                    if(existingFallbackSlug.length > 0) {
                        throw new Error("Unable to generate a unique slug, including fallback");
                    }
                }
            }

            const createdAt = Date.now();
            const avatar = avatar_url || "https://modifold.com/images/user/default_ava.png";

            const [result] = await db.query(
                "INSERT INTO users (username, slug, github_id, email, created_at, avatar) VALUES (?, ?, ?, ?, ?, ?)",
                [displayName, slug, githubId, email, createdAt, avatar]
            );

            user = { id: result.insertId, username: displayName, slug };
        }

        const twoFactorRow = await getTwoFactorRow(user.id);
        if(isTwoFactorEnabled(twoFactorRow)) {
            const twoFactorToken = issueTwoFactorToken(user.id);
            return redirectToFrontendAuth(res, { twofactor: "1", twofactor_token: twoFactorToken, next: nextPath });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
        return redirectToFrontendAuth(res, { token, next: nextPath });
    } catch (error) {
        console.error("GitHub Callback Error:", error.message, error.stack);
        return redirectToFrontendAuth(res, { error: error.message || "Error processing GitHub callback", next: nextPath });
    }
});

router.get("/user", auth, async (req, res) => {
    try {
        const [users] = await db.query("SELECT id, username, slug, avatar, cover, description, created_at, isVerified, telegram_id, github_id, isRole, social_links FROM users WHERE id = ?", [req.user.id]);

        if(!users.length) {
            return res.status(404).json({ message: "User not found" });
        }

        const userData = {
            ...users[0],
            social_links: users[0].social_links ? JSON.parse(users[0].social_links) : {},
        };

        res.json({ user: userData, success: true });
    } catch (error) {
        console.error("Auth /user Error:", {
            message: error?.message || "unknown error",
            stack: error?.stack || null,
            user_id: req.user?.id || null,
        });
        res.status(500).json({ message: "Error receiving user data", error });
    }
});

router.get("/2fa/status", auth, async (req, res) => {
    try {
        const twoFactorRow = await getTwoFactorRow(req.user.id);
        res.json({ enabled: isTwoFactorEnabled(twoFactorRow) });
    } catch (error) {
        console.error("2FA status error:", error);
        res.status(500).json({ message: "Error fetching 2FA status" });
    }
});

router.get("/password/status", auth, async (req, res) => {
    try {
        const [users] = await db.query("SELECT password_hash, email_login_key FROM users WHERE id = ? LIMIT 1", [req.user.id]);
        const user = users[0];

        if(!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ enabled: Boolean(user.password_hash && user.email_login_key) });
    } catch (error) {
        console.error("Password status error:", error);
        res.status(500).json({ message: "Error fetching password status" });
    }
});

router.post("/password/change", auth, async (req, res) => {
    try {
        const currentPassword = req.body?.currentPassword;
        const newPassword = req.body?.newPassword;

        if(typeof currentPassword !== "string" || typeof newPassword !== "string") {
            return res.status(400).json({ code: "missing_fields", message: "Current password and new password are required" });
        }

        const passwordError = validatePassword(newPassword);
        if(passwordError) {
            return res.status(400).json({ code: "password_too_short", message: passwordError });
        }

        const [users] = await db.query("SELECT password_hash, email_login_key FROM users WHERE id = ? LIMIT 1", [req.user.id]);
        const user = users[0];

        if(!user) {
            return res.status(404).json({ code: "user_not_found", message: "User not found" });
        }

        if(!user.password_hash || !user.email_login_key) {
            return res.status(400).json({ code: "password_login_disabled", message: "Password login is not enabled for this account" });
        }

        const passwordMatches = await verifyPassword(currentPassword, user.password_hash);
        if(!passwordMatches) {
            return res.status(400).json({ code: "current_password_incorrect", message: "Current password is incorrect" });
        }

        const passwordUnchanged = await verifyPassword(newPassword, user.password_hash);
        if(passwordUnchanged) {
            return res.status(400).json({ code: "password_unchanged", message: "New password must be different from the current password" });
        }

        const newPasswordHash = await hashPassword(newPassword);
        await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [newPasswordHash, req.user.id]);

        res.json({ success: true });
    } catch (error) {
        console.error("Password change error:", error);
        res.status(500).json({ code: "generic", message: "Error changing password" });
    }
});

router.post("/2fa/setup", auth, async (req, res) => {
    try {
        const twoFactorRow = await getTwoFactorRow(req.user.id);
        if(twoFactorRow && twoFactorRow.enabled === 1) {
            return res.status(400).json({ message: "2FA already enabled" });
        }

        const [users] = await db.query("SELECT username, slug, email FROM users WHERE id = ? LIMIT 1", [req.user.id]);
        const user = users[0];
        if(!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const secret = authenticator.generateSecret();
        const label = user.email || user.username || user.slug || "Modifold";
        const otpauth = authenticator.keyuri(label, "Modifold", secret);
        const now = Date.now();

        await db.query(
            "INSERT INTO user_two_factor (user_id, secret, enabled, created_at, updated_at) VALUES (?, ?, 0, ?, ?) ON DUPLICATE KEY UPDATE secret = VALUES(secret), enabled = 0, updated_at = VALUES(updated_at)",
            [req.user.id, secret, now, now]
        );

        res.json({ secret, otpauth });
    } catch (error) {
        console.error("2FA setup error:", error);
        res.status(500).json({ message: "Error creating 2FA setup" });
    }
});

router.post("/2fa/confirm", auth, async (req, res) => {
    try {
        const code = String(req.body?.code || "").replace(/\s+/g, "");
        if(!code) {
            return res.status(400).json({ message: "Code is required" });
        }

        const twoFactorRow = await getTwoFactorRow(req.user.id);
        if(!twoFactorRow?.secret) {
            return res.status(400).json({ message: "2FA setup not initialized" });
        }

        const isValid = authenticator.check(code, twoFactorRow.secret);
        if(!isValid) {
            return res.status(400).json({ message: "Invalid code" });
        }

        const now = Date.now();
        await db.query(
            "UPDATE user_two_factor SET enabled = 1, enabled_at = ?, updated_at = ? WHERE user_id = ?",
            [now, now, req.user.id]
        );

        res.json({ enabled: true });
    } catch (error) {
        console.error("2FA confirm error:", error);
        res.status(500).json({ message: "Error confirming 2FA" });
    }
});

router.post("/2fa/disable", auth, async (req, res) => {
    try {
        const code = String(req.body?.code || "").replace(/\s+/g, "");
        if(!code) {
            return res.status(400).json({ message: "Code is required" });
        }

        const twoFactorRow = await getTwoFactorRow(req.user.id);
        if(!isTwoFactorEnabled(twoFactorRow)) {
            return res.status(400).json({ message: "2FA is not enabled" });
        }

        const isValid = authenticator.check(code, twoFactorRow.secret);
        if(!isValid) {
            return res.status(400).json({ message: "Invalid code" });
        }

        const now = Date.now();
        await db.query(
            "UPDATE user_two_factor SET enabled = 0, secret = NULL, updated_at = ? WHERE user_id = ?",
            [now, req.user.id]
        );

        res.json({ enabled: false });
    } catch (error) {
        console.error("2FA disable error:", error);
        res.status(500).json({ message: "Error disabling 2FA" });
    }
});

router.post("/2fa/verify-login", async (req, res) => {
    try {
        const { token, code } = req.body || {};
        if(!token || !code) {
            return res.status(400).json({ message: "Token and code are required" });
        }

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ message: "Invalid or expired 2FA token" });
        }

        if(payload?.type !== "2fa") {
            return res.status(401).json({ message: "Invalid 2FA token" });
        }

        const userId = payload.id;
        const twoFactorRow = await getTwoFactorRow(userId);
        if(!isTwoFactorEnabled(twoFactorRow)) {
            return res.status(400).json({ message: "2FA is not enabled" });
        }

        const normalizedCode = String(code).replace(/\s+/g, "");
        const isValid = authenticator.check(normalizedCode, twoFactorRow.secret);
        if(!isValid) {
            return res.status(400).json({ message: "Invalid code" });
        }

        const now = Date.now();
        await db.query("UPDATE user_two_factor SET last_used_at = ? WHERE user_id = ?", [now, userId]);

        const authToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ token: authToken, success: true });
    } catch (error) {
        console.error("2FA login verify error:", error);
        res.status(500).json({ message: "Error verifying 2FA code" });
    }
});

module.exports = router;