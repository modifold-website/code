const express = require("express");
const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const router = express.Router();

const getVisibleNotificationPredicate = (alias) => `
	NOT (
		${alias}.event_type IN ('project_version_release', 'project_version_approved', 'project_version_rejected')
		AND ${alias}.object_type = 'project_version'
		AND NOT EXISTS (
			SELECT 1 FROM project_versions visible_pv
			WHERE BINARY visible_pv.id = BINARY ${alias}.object_id
		)
	)
	AND NOT (
		${alias}.event_type = 'project_collaboration_invite'
		AND ${alias}.object_type = 'project'
		AND NOT EXISTS (
			SELECT 1 FROM project_members visible_pm
			WHERE BINARY visible_pm.project_id = BINARY ${alias}.object_id
			AND BINARY visible_pm.user_id = BINARY ${alias}.recipient_user_id
			AND visible_pm.status = 'pending'
		)
	)`;

router.get("/unread-count", auth, async (req, res) => {
    const userId = req.user.id;

    try {
        const [[row]] = await db.query(
            `SELECT COUNT(*) AS unreadCount
            FROM notification_events ne
            WHERE ne.recipient_user_id = ?
			AND ne.read_at IS NULL
			AND ${getVisibleNotificationPredicate("ne")}`,
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
            FROM notification_events ne
            WHERE ne.recipient_user_id = ?
			AND ${getVisibleNotificationPredicate("ne")}
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
            FROM notification_events ne
            WHERE ne.recipient_user_id = ?
			AND ${getVisibleNotificationPredicate("ne")}
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
				`SELECT
				p.id,
				p.slug,
				p.title,
				p.icon_url,
				p.project_type,
				(
					SELECT pml.reason
					FROM project_moderation_logs pml
					WHERE BINARY pml.project_id = BINARY p.id
					AND pml.action = 'rejected'
					ORDER BY pml.created_at DESC, pml.id DESC
					LIMIT 1
				) AS moderation_reason
				FROM projects p
				WHERE p.id IN (?)`,
                [projectIds]
            );

            projectMap = new Map(projectRows.map((project) => [String(project.id), {
                id: project.id,
                slug: project.slug,
                title: project.title,
                iconUrl: project.icon_url,
                project_type: project.project_type,
				moderationReason: project.moderation_reason,
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
				pv.moderation_reason,
                p.id AS project_id,
                p.slug AS project_slug,
                p.title AS project_title,
                p.icon_url AS project_icon_url,
                p.project_type,
                p.user_id AS project_owner_user_id,
                u.username AS owner_username,
                u.slug AS owner_slug,
                u.avatar AS owner_avatar,
                u.isVerified AS owner_is_verified,
                u.active_profile_badge AS owner_active_profile_badge
                FROM project_versions pv
                INNER JOIN projects p ON p.id = pv.project_id
                LEFT JOIN users u ON u.id = p.user_id
                WHERE pv.id IN (?)`,
                [projectVersionIds]
            );

            projectVersionMap = new Map(projectVersionRows.map((version) => [String(version.id), {
                id: version.id,
                versionNumber: version.version_number,
                createdAt: Number(version.created_at || 0),
				moderationReason: version.moderation_reason,
                project: {
                    id: version.project_id,
                    slug: version.project_slug,
                    title: version.project_title,
                    iconUrl: version.project_icon_url,
                    project_type: version.project_type,
                },
                ownerActor: version.project_owner_user_id ? {
                    id: version.project_owner_user_id,
                    username: version.owner_username,
                    slug: version.owner_slug,
                    avatar: version.owner_avatar,
                    isVerified: Number(version.owner_is_verified || 0),
                    activeProfileBadge: version.owner_active_profile_badge,
                    createdAt: Number(version.created_at || 0),
                } : null,
            }]));
        }

		const getGroupKey = (row) => `${row.event_type}:${row.object_type}:${row.object_id}:${Number(row.group_bucket) || 0}`;
		const actorConditions = [];
		const actorParams = [userId];
		for(const row of groupRows) {
			const condition = ["ne.event_type = ?", "ne.object_type = ?", "ne.object_id = ?"];
			actorParams.push(row.event_type, row.object_type, row.object_id);
			const groupBucket = Number(row.group_bucket);
			if(row.event_type === "follow" && Number.isFinite(groupBucket)) {
				const bucketStart = groupBucket * daySeconds + tzOffsetSeconds;
				condition.push("ne.created_at >= ?", "ne.created_at < ?");
				actorParams.push(bucketStart, bucketStart + daySeconds);
			}
            
			actorConditions.push(`(${condition.join(" AND ")})`);
		}

		const actorsByGroup = new Map();
		if(actorConditions.length) {
			const bucketExpression = `CASE WHEN ne.event_type = 'follow' THEN FLOOR((ne.created_at - ${tzOffsetSeconds}) / ${daySeconds}) ELSE 0 END`;
			const [actorRows] = await db.query(
				`SELECT * FROM (
					SELECT
					ne.event_type, ne.object_type, ne.object_id,
					${bucketExpression} AS group_bucket,
					ne.actor_user_id, ne.created_at,
					u.username, u.slug, u.avatar, u.isVerified,
					u.active_profile_badge AS activeProfileBadge,
					ROW_NUMBER() OVER (
						PARTITION BY ne.event_type, ne.object_type, ne.object_id, ${bucketExpression}
						ORDER BY ne.created_at DESC, ne.id DESC
					) AS actor_rank
					FROM notification_events ne
					INNER JOIN users u ON u.id = ne.actor_user_id
					WHERE ne.recipient_user_id = ?
					AND ${getVisibleNotificationPredicate("ne")}
					AND (${actorConditions.join(" OR ")})
				) ranked
				WHERE actor_rank <= 3
				ORDER BY created_at DESC`,
				actorParams
			);

			for(const actor of actorRows) {
				const key = getGroupKey(actor);
				const actors = actorsByGroup.get(key) || [];
				actors.push({
					id: actor.actor_user_id,
					username: actor.username,
					slug: actor.slug,
					avatar: actor.avatar,
					isVerified: Number(actor.isVerified || 0),
					activeProfileBadge: actor.activeProfileBadge,
					createdAt: Number(actor.created_at),
				});
				actorsByGroup.set(key, actors);
			}
		}

		const organizationInviteMap = new Map();
		if(organizationIds.length) {
			const [inviteRows] = await db.query(
				`SELECT id, organization_id
				FROM organization_invitations
				WHERE organization_id IN (?) AND invited_user_id = ? AND status = 'pending'
				ORDER BY created_at DESC`,
				[organizationIds, userId]
			);

			for(const invite of inviteRows) {
				const key = String(invite.organization_id);
				if(!organizationInviteMap.has(key)) {
					organizationInviteMap.set(key, invite.id);
				}
			}
		}

		const projectInviteMap = new Map();
		if(projectIds.length) {
			const [inviteRows] = await db.query(
				`SELECT id, project_id
				FROM project_members
				WHERE project_id IN (?) AND user_id = ? AND status = 'pending'
				ORDER BY created_at DESC`,
				[projectIds, userId]
			);

			for(const invite of inviteRows) {
				const key = String(invite.project_id);
				if(!projectInviteMap.has(key)) {
					projectInviteMap.set(key, invite.id);
				}
			}
		}

		const notifications = groupRows.map((row) => {
            const projectVersion = row.object_type === "project_version" ? (projectVersionMap.get(String(row.object_id)) || null) : null;
			let normalizedActors = actorsByGroup.get(getGroupKey(row)) || [];

            if(row.event_type === "project_version_release" && projectVersion?.ownerActor) {
                normalizedActors = [{
                    ...projectVersion.ownerActor,
                    createdAt: Number(row.latest_at),
                }];
            }

            const responseProjectVersion = projectVersion ? {
                id: projectVersion.id,
                versionNumber: projectVersion.versionNumber,
                createdAt: projectVersion.createdAt,
                project: projectVersion.project,
            } : null;
			const project = row.object_type === "project" ? (projectMap.get(String(row.object_id)) || null) : null;
			const moderationReason = row.event_type === "project_rejected"
				? project?.moderationReason
				: row.event_type === "project_version_rejected" ? projectVersion?.moderationReason : null;

			let inviteId = null;
			if(row.object_type === "organization" && row.event_type === "organization_invite") {
				inviteId = organizationInviteMap.get(String(row.object_id)) || null;
			} else if(row.object_type === "project" && row.event_type === "project_collaboration_invite") {
				inviteId = projectInviteMap.get(String(row.object_id)) || null;
			}

            return {
                id: `${row.event_type}:${row.object_type}:${row.object_id}:${row.group_bucket}`,
                eventType: row.event_type,
                objectType: row.object_type,
                objectId: row.object_id,
                inviteId,
                totalCount: Number(row.total_count),
                latestAt: Number(row.latest_at),
				moderationReason: moderationReason || null,
                actors: normalizedActors,
				project,
                projectVersion: responseProjectVersion,
                organization: row.object_type === "organization" ? (organizationMap.get(String(row.object_id)) || null) : null,
            };
		});

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