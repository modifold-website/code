const express = require("express");
const { db } = require("../config/db");
const auth = require("../middleware/auth");
const router = express.Router();

router.get("/:userId", auth, async (req, res) => {
    try {
        const [subscription] = await db.query("SELECT id FROM subs WHERE userid = ? AND author_id = ?", [req.params.userId, req.user.id]);

        res.json({ isSubscribed: !!subscription.length, subscriptionId: subscription[0]?.id || null });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error checking subscription", error });
    }
});

router.post("/", auth, async (req, res) => {
    const { userId } = req.body;
    const subscriberId = req.user.id;

    try {
        const [existing] = await db.query("SELECT id FROM subs WHERE userid = ? AND author_id = ?", [userId, subscriberId]);
        if(existing.length) {
            return res.status(400).json({ message: "You are already subscribed" });
        }

        const [subscription] = await db.query("INSERT INTO subs (userid, author_id, type, date) VALUES (?, ?, ?, ?)", [userId, subscriberId, "user", Math.floor(Date.now() / 1000)]);

        if(userId !== subscriberId) {
            await db.query(
                `INSERT INTO notification_events
                (recipient_user_id, actor_user_id, event_type, object_type, object_id, created_at)
                VALUES (?, ?, 'follow', 'user', '', ?)
                ON DUPLICATE KEY UPDATE created_at = VALUES(created_at)`,
                [userId, subscriberId, Math.floor(Date.now() / 1000)]
            );
        }

        res.json({ subscriptionId: subscription.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error during subscription", error });
    }
});

router.delete("/:id", auth, async (req, res) => {
    const subscriberId = req.user.id;

    try {
        const [subscription] = await db.query("SELECT userid FROM subs WHERE id = ? AND author_id = ?", [req.params.id, subscriberId]);
        if(!subscription.length) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        await db.query("DELETE FROM subs WHERE id = ? AND author_id = ?", [req.params.id, subscriberId]);
        await db.query(
            `DELETE FROM notification_events
            WHERE recipient_user_id = ?
            AND actor_user_id = ?
            AND event_type = 'follow'
            AND object_type = 'user'
            AND object_id = ''`,
            [subscription[0].userid, subscriberId]
        );

        res.json({ message: "Subscription deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error when unsubscribing", error });
    }
});

module.exports = router;