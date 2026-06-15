const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { db } = require('../../config/db');
const crypto = require('crypto');

const TOKEN_PREFIX = 'mf_';
const TOKEN_LENGTH = 48;

function generateApiToken() {
    const randomBytes = crypto.randomBytes(TOKEN_LENGTH);
    return TOKEN_PREFIX + randomBytes.toString('base64url');
}

router.get('/', auth, async (req, res) => {
    try {
        const [tokens] = await db.query(
            `SELECT id, name, token, expires_at, created_at, last_used_at, revoked 
            FROM api_tokens 
            WHERE user_id = ? 
            ORDER BY created_at DESC`,
            [req.user.id]
        );

        const masked = tokens.map(t => ({
            ...t,
            token: t.token.substring(0, 12) + '...' + t.token.slice(-8)
        }));

        res.json({ tokens: masked });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/', auth, async (req, res) => {
    const { name = 'New API token', duration } = req.body;

    let expiresAt = null;

    const now = new Date();

    switch(duration) {
        case '1w': expiresAt = new Date(now.setDate(now.getDate() + 7)); break;
        case '1m': expiresAt = new Date(now.setMonth(now.getMonth() + 1)); break;
        case '3m': expiresAt = new Date(now.setMonth(now.getMonth() + 3)); break;
        case '1y': expiresAt = new Date(now.setFullYear(now.getFullYear() + 1)); break;
        case 'forever':
        case null:
        case undefined: expiresAt = null; break;
        default: return res.status(400).json({ error: 'Invalid duration. Use: 1w, 1m, 3m, 1y, forever' });
    }

    const token = generateApiToken();

    try {
        await db.query(
            `INSERT INTO api_tokens (user_id, token, name, expires_at)
            VALUES (?, ?, ?, ?)`,
            [req.user.id, token, name, expiresAt]
        );

        res.status(201).json({
            token,
            name,
            expires_at: expiresAt,
            message: 'Token created successfully. Save it now — it will not be shown again!'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create token' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(
            `DELETE FROM api_tokens 
            WHERE id = ? AND user_id = ?`,
            [id, req.user.id]
        );

        if(result.affectedRows === 0) {
            return res.status(404).json({ 
                error: 'Token not found or does not belong to you' 
            });
        }

        res.json({ 
            success: true, 
            message: 'API token has been permanently deleted' 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;