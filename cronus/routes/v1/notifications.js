const express = require("express");
const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const router = express.Router();

const cleanupStaleProjectVersionReleaseNotifications = async (userId) => {
    await db.query(
        `DELETE ne
        FROM notification_events ne
        LEFT JOIN project_versions pv ON BINARY pv.id = BINARY ne.object_id
        WHERE ne.recipient_user_id = ?
        AND ne.event_type = 'project_version_release'
        AND ne.object_type = 'project_version'
        AND pv.id IS NULL`,
        [userId]
    );
};

router.get("/unread-count", auth, async (req, res) => {
    const userId = req.user.id;

    try {
        await cleanupStaleProjectVersionReleaseNotifications(userId);

        const [[row]] = await db.query(
            `SELECT COUNT(*) AS unreadCount
            FROM notification_events
            WHERE recipient_user_id = ?
            AND read_at IS NULL`,
            [userId]
        );

        return res.json({ unreadCount: Number(row?.unreadCount || 0) });
    } catch (error) {
        console.error("Error fetching unread notifications count:", error);
        return res.status(500).json({ message: "Error fetching unread notifications count", error: error.message });
    }
});

router.post("/mark-all-read", auth, async (req, res) => {
    const userId = req.user.id;
    const now = Math.floor(Date.now() / 1000);

    try {
        const [result] = await db.query(
            `UPDATE notification_events
            SET read_at = ?
            WHERE recipient_user_id = ?
            AND read_at IS NULL`,
            [now, userId]
        );

        return res.json({ success: true, updated: Number(result?.affectedRows || 0) });
    } catch (error) {
        console.error("Error marking notifications as read:", error);
        return res.status(500).json({ message: "Error marking notifications as read", error: error.message });
    }
});

router.get("/", auth, async (req, res) => {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const daySeconds = 86400;
    const rawTzOffset = Number.parseInt(req.query.tzOffset, 10);
    const tzOffsetMinutes = Number.isFinite(rawTzOffset) ? rawTzOffset : 0;
    const clampedTzOffsetMinutes = Math.max(Math.min(tzOffsetMinutes, 14 * 60), -14 * 60);
    const tzOffsetSeconds = clampedTzOffsetMinutes * 60;

    try {
        await cleanupStaleProjectVersionReleaseNotifications(userId);

        const [groupRows] = await db.query(
            `SELECT
            event_type,
            object_type,
            object_id,
            CASE
                WHEN event_type = 'follow' THEN FLOOR((created_at - ?) / ${daySeconds})
                ELSE 0
            END AS group_bucket,
            MAX(created_at) AS latest_at,
            COUNT(*) AS total_count
            FROM notification_events
            WHERE recipient_user_id = ?
            GROUP BY event_type, object_type, object_id,
                CASE
                    WHEN event_type = 'follow' THEN FLOOR((created_at - ?) / ${daySeconds})
                    ELSE 0
                END
            ORDER BY latest_at DESC
            LIMIT ? OFFSET ?`,
            [tzOffsetSeconds, userId, tzOffsetSeconds, limit, offset]
        );

        const [[{ totalGroups }]] = await db.query(
            `SELECT COUNT(*) AS totalGroups
            FROM (
            SELECT event_type, object_type, object_id
            FROM notification_events
            WHERE recipient_user_id = ?
            GROUP BY event_type, object_type, object_id,
                CASE
                    WHEN event_type = 'follow' THEN FLOOR((created_at - ?) / ${daySeconds})
                    ELSE 0
                END
            ) AS grouped`,
            [userId, tzOffsetSeconds]
        );

        const projectIds = groupRows.filter((row) => row.object_type === "project" && row.object_id).map((row) => row.object_id);
        const projectVersionIds = groupRows.filter((row) => row.object_type === "project_version" && row.object_id).map((row) => row.object_id);
        const organizationIds = groupRows.filter((row) => row.object_type === "organization" && row.object_id).map((row) => row.object_id);

        let projectMap = new Map();
        if(projectIds.length > 0) {
            const [projectRows] = await db.query(
                `SELECT id, slug, title, icon_url, project_type
                FROM projects
                WHERE id IN (?)`,
                [projectIds]
            );

            projectMap = new Map(projectRows.map((project) => [String(project.id), {
                id: project.id,
                slug: project.slug,
                title: project.title,
                iconUrl: project.icon_url,
                project_type: project.project_type,
            }]));
        }

        let organizationMap = new Map();
        if(organizationIds.length > 0) {
            const [organizationRows] = await db.query(
                `SELECT id, slug, name, icon_url
                FROM organizations
                WHERE id IN (?)`,
                [organizationIds]
            );

            organizationMap = new Map(organizationRows.map((organization) => [String(organization.id), {
                id: organization.id,
                slug: organization.slug,
                name: organization.name,
                iconUrl: organization.icon_url,
            }]));
        }

        let projectVersionMap = new Map();
        if(projectVersionIds.length > 0) {
            const [projectVersionRows] = await db.query(
                `SELECT
                pv.id,
                pv.version_number,
                pv.created_at,
                p.id AS project_id,
                p.slug AS project_slug,
                p.title AS project_title,
                p.icon_url AS project_icon_url,
                p.project_type
                FROM project_versions pv
                INNER JOIN projects p ON p.id = pv.project_id
                WHERE pv.id IN (?)`,
                [projectVersionIds]
            );

            projectVersionMap = new Map(projectVersionRows.map((version) => [String(version.id), {
                id: version.id,
                versionNumber: version.version_number,
                createdAt: Number(version.created_at || 0),
                project: {
                    id: version.project_id,
                    slug: version.project_slug,
                    title: version.project_title,
                    iconUrl: version.project_icon_url,
                    project_type: version.project_type,
                },
            }]));
        }

        const notifications = await Promise.all(groupRows.map(async (row) => {
            const actorParams = [userId, row.event_type, row.object_type, row.object_id];
            let actorQuery = `SELECT
                ne.actor_user_id,
                ne.created_at,
                u.username,
                u.slug,
                u.avatar,
                u.isVerified
                FROM notification_events ne
                INNER JOIN users u ON u.id = ne.actor_user_id
                WHERE ne.recipient_user_id = ?
                AND ne.event_type = ?
                AND ne.object_type = ?
                AND ne.object_id = ?`;

            const groupBucketNumber = Number(row.group_bucket);
            if(row.event_type === "follow" && Number.isFinite(groupBucketNumber)) {
                const bucketStart = groupBucketNumber * daySeconds + tzOffsetSeconds;
                const bucketEnd = bucketStart + daySeconds;
                actorQuery += " AND ne.created_at >= ? AND ne.created_at < ?";
                actorParams.push(bucketStart, bucketEnd);
            }

            actorQuery += " ORDER BY ne.created_at DESC LIMIT 3";

            const [actors] = await db.query(actorQuery, actorParams);

            let inviteId = null;
            if(row.object_type === "organization" && row.event_type === "organization_invite") {
                const [inviteRows] = await db.query(
                    `SELECT id
                    FROM organization_invitations
                    WHERE organization_id = ?
                    AND invited_user_id = ?
                    AND status = 'pending'
                    ORDER BY created_at DESC
                    LIMIT 1`,
                    [row.object_id, userId]
                );
                inviteId = inviteRows[0]?.id || null;
            }

            return {
                id: `${row.event_type}:${row.object_type}:${row.object_id}:${row.group_bucket}`,
                eventType: row.event_type,
                objectType: row.object_type,
                objectId: row.object_id,
                inviteId,
                totalCount: Number(row.total_count),
                latestAt: Number(row.latest_at),
                actors: actors.map((actor) => ({
                    id: actor.actor_user_id,
                    username: actor.username,
                    slug: actor.slug,
                    avatar: actor.avatar,
                    isVerified: Number(actor.isVerified || 0),
                    createdAt: Number(actor.created_at),
                })),
                project: row.object_type === "project" ? (projectMap.get(String(row.object_id)) || null) : null,
                projectVersion: row.object_type === "project_version" ? (projectVersionMap.get(String(row.object_id)) || null) : null,
                organization: row.object_type === "organization" ? (organizationMap.get(String(row.object_id)) || null) : null,
            };
        }));

        return res.json({
            notifications,
            pagination: {
                page,
                limit,
                total: Number(totalGroups),
                totalPages: Math.ceil(Number(totalGroups) / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return res.status(500).json({ message: "Error fetching notifications", error: error.message });
    }
});

module.exports = router;