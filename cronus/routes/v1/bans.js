const { logger } = require("../../packages/shared/logger");

const express = require("express");
const { db } = require("../../config/db");
const router = express.Router();

router.get("/:id", async (req, res) => {
    try {
        const [ban] = await db.query("SELECT * FROM bans WHERE user_id = ?", [req.params.id]);
        
        res.json({ isBanned: !!ban.length });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: "Error checking ban", error });
    }
});

module.exports = router;