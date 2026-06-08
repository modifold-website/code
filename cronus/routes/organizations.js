const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const slugify = require("slugify");
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");
const auth = require("../middleware/auth");
const { db } = require("../config/db");
const { sanitizePlainText, sanitizeExternalUrl } = require("../utils/sanitize");
const { normalizeSlugInput, validateSlug, getSlugValidationMessage } = require("../utils/slug");
const { ORG_PERMISSIONS, ORG_PROJECT_PERMISSIONS, parsePermissions, getOrganizationMemberAccess, hasOrganizationPermission, logOrganizationAudit } = require("../utils/organizations");

const router = express.Router();

const generateId = () => crypto.randomBytes(6).toString("base64url");

const DEFAULT_MEMBER_PROJECT_PERMISSIONS = [
    ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
    ORG_PROJECT_PERMISSIONS.EDIT_BODY,
    ORG_PROJECT_PERMISSIONS.EDIT_GALLERY,
    ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS,
];

const DEFAULT_MEMBER_ORGANIZATION_PERMISSIONS = [];
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if(allowed.includes(String(file.mimetype || "").toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"));
        }
    },
});

const buildOrganizationSummary = (org) => ({
    id: org.id,
    slug: org.slug,
    name: org.name,
    summary: org.summary || "",
    icon_url: org.icon_url || "https://media.modifold.com/static/no-project-icon.svg",
    discord_url: org.discord_url || null,
    website_url: org.website_url || null,
    twitter_url: org.twitter_url || null,
    bluesky_url: org.bluesky_url || null,
    telegram_url: org.telegram_url || null,
    youtube_url: org.youtube_url || null,
});

const getOrganizationBySlug = async (slug) => {
    const [rows] = await db.query(
        `SELECT id, slug, name, summary, icon_url, owner_user_id, created_at, updated_at,
        discord_url, website_url, twitter_url, bluesky_url, telegram_url, youtube_url
        FROM organizations
        WHERE slug = ?
        LIMIT 1`,
        [slug]
    );

    return rows[0] || null;
};

const getMemberView = (row) => ({
    user_id: row.user_id,
    username: row.username,
    slug: row.slug,
    avatar: row.avatar,
    isVerified: row.isVerified,
    role: row.role,
    status: row.status,
    project_permissions: parsePermissions(row.project_permissions),
    organization_permissions: parsePermissions(row.organization_permissions),
});

const sanitizeOptionalOrganizationLink = (value) => {
    if(value === undefined) {
        return { provided: false, value: null, invalid: false };
    }

    const raw = typeof value === "string" ? value.trim() : "";
    if(!raw) {
        return { provided: true, value: null, invalid: false };
    }

    const safeUrl = sanitizeExternalUrl(raw);
    if(!safeUrl) {
        return { provided: true, value: null, invalid: true };
    }

    return { provided: true, value: safeUrl, invalid: false };
};

const getOptionalViewerId = async (req) => {
    const authHeader = req.headers.authorization;
    if(!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.slice(7).trim();
    if(!token) {
        return null;
    }

    if(token.startsWith("mf_")) {
        try {
            const [rows] = await db.query(
                `SELECT user_id, expires_at
                FROM api_tokens
                WHERE token = ?
                LIMIT 1`,
                [token]
            );

            if(rows.length === 0) {
                return null;
            }

            const apiToken = rows[0];
            if(apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
                return null;
            }

            return Number(apiToken.user_id) || null;
        } catch {
            return null;
        }
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return Number(decoded?.id) || null;
    } catch {
        return null;
    }
};

router.get("/dashboard/organizations", auth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
            o.id,
            o.slug,
            o.name,
            o.summary,
            o.icon_url,
            o.owner_user_id,
            om.role,
            om.status,
            om.project_permissions,
            om.organization_permissions,
            (SELECT COUNT(*) FROM organization_members om2 WHERE om2.organization_id COLLATE utf8mb4_unicode_ci = o.id COLLATE utf8mb4_unicode_ci AND om2.status = 'accepted') AS members_count
            FROM organization_members om
            INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = om.organization_id COLLATE utf8mb4_unicode_ci
            WHERE om.user_id = ?
            AND om.status = 'accepted'
            ORDER BY o.updated_at DESC`,
            [req.user.id]
        );

        const organizations = rows.map((row) => {
            const isOwner = Number(row.owner_user_id) === Number(req.user.id);
            const organizationPermissions = new Set(
                isOwner ? Object.values(ORG_PERMISSIONS) : parsePermissions(row.organization_permissions)
            );

            return {
                ...buildOrganizationSummary(row),
                members_count: Number(row.members_count || 0),
                role: row.role,
                is_owner: isOwner,
                can_manage: isOwner || organizationPermissions.has(ORG_PERMISSIONS.MANAGE_INVITES) || organizationPermissions.has(ORG_PERMISSIONS.MANAGE_MEMBERS) || organizationPermissions.has(ORG_PERMISSIONS.EDIT_DETAILS),
            };
        });

        return res.json({ organizations });
    } catch (error) {
        console.error("Error fetching organizations dashboard:", error);
        return res.status(500).json({ message: "Error fetching organizations" });
    }
});

router.post("/", auth, async (req, res) => {
    try {
        const rawName = sanitizePlainText(req.body?.name || "");
        const rawSlug = sanitizePlainText(req.body?.slug || "");
        const rawSummary = sanitizePlainText(req.body?.summary || "", { preserveNewlines: true });
        const iconUrl = sanitizePlainText(req.body?.icon_url || "");

        if(!rawName || !rawSummary) {
            return res.status(400).json({ message: "Name and summary are required" });
        }

        const baseSlug = normalizeSlugInput(rawSlug || slugify(rawName, { lower: true, strict: true, remove: /[^a-zA-Z0-9\s-]/g }));
        const slugValidation = validateSlug(baseSlug);
        if(!slugValidation.valid) {
            return res.status(400).json({ message: getSlugValidationMessage(slugValidation.reason), code: slugValidation.reason });
        }

        const [slugRows] = await db.query("SELECT 1 FROM organizations WHERE slug = ? LIMIT 1", [slugValidation.normalized]);
        if(slugRows.length > 0) {
            return res.status(400).json({ message: "This URL is already taken", code: "slug_taken" });
        }

        const now = Math.floor(Date.now() / 1000);
        const organizationId = generateId();

        await db.query(
            `INSERT INTO organizations
            (id, slug, name, summary, icon_url, owner_user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                organizationId,
                slugValidation.normalized,
                rawName,
                rawSummary,
                iconUrl || "https://media.modifold.com/static/no-project-icon.svg",
                req.user.id,
                now,
                now,
            ]
        );

        await db.query(
            `INSERT INTO organization_members
            (organization_id, user_id, role, status, project_permissions, organization_permissions, created_at, updated_at)
            VALUES (?, ?, 'Owner', 'accepted', ?, ?, ?, ?)`,
            [
                organizationId,
                req.user.id,
                JSON.stringify(Object.values(ORG_PROJECT_PERMISSIONS)),
                JSON.stringify(Object.values(ORG_PERMISSIONS)),
                now,
                now,
            ]
        );

        await logOrganizationAudit(db, {
            organizationId,
            actorUserId: req.user.id,
            action: "organization_created",
            targetType: "organization",
            targetId: organizationId,
            metadata: { name: rawName, slug: slugValidation.normalized },
        });

        return res.status(201).json({
            success: true,
            organization: {
                id: organizationId,
                slug: slugValidation.normalized,
                name: rawName,
                summary: rawSummary,
                icon_url: iconUrl || "https://media.modifold.com/static/no-project-icon.svg",
            },
        });
    } catch (error) {
        console.error("Error creating organization:", error);
        return res.status(500).json({ message: "Error creating organization" });
    }
});

router.get("/slug-availability/:slug", auth, async (req, res) => {
    try {
        const candidateSlug = normalizeSlugInput(req.params.slug);
        const currentOrganizationSlug = String(req.query.current || "").toLowerCase();
        const allowLegacy = Boolean(candidateSlug && candidateSlug === currentOrganizationSlug);
        const validation = validateSlug(candidateSlug, { allowLegacy });

        if(!validation.valid) {
            return res.json({
                available: false,
                normalized: validation.normalized,
                reason: validation.reason,
                message: getSlugValidationMessage(validation.reason),
            });
        }

        if(validation.normalized === currentOrganizationSlug) {
            return res.json({
                available: true,
                normalized: validation.normalized,
                reason: null,
                message: null,
            });
        }

        const [rows] = await db.query("SELECT 1 FROM organizations WHERE slug = ? LIMIT 1", [validation.normalized]);
        if(rows.length > 0) {
            return res.json({
                available: false,
                normalized: validation.normalized,
                reason: "slug_taken",
                message: "This URL is already taken",
            });
        }

        return res.json({
            available: true,
            normalized: validation.normalized,
            reason: null,
            message: null,
        });
    } catch (error) {
        console.error("Error checking organization slug availability:", error);
        return res.status(500).json({ message: "Error checking slug availability" });
    }
});

router.get("/:slug", async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const viewerUserId = await getOptionalViewerId(req);
        const viewerAccess = Number.isFinite(viewerUserId) && viewerUserId > 0 ? await getOrganizationMemberAccess(db, organization.id, viewerUserId) : null;
        const canViewAllOrganizationProjects = Boolean(viewerAccess);

        const [members] = await db.query(
            `SELECT
            om.user_id,
            om.role,
            om.status,
            om.project_permissions,
            om.organization_permissions,
            u.username,
            u.slug,
            u.avatar,
            u.isVerified
            FROM organization_members om
            INNER JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = ?
            AND om.status = 'accepted'
            ORDER BY (om.user_id = ?) DESC, om.created_at ASC`,
            [organization.id, organization.owner_user_id]
        );

        const [projects] = await db.query(
            `SELECT p.id, p.slug, p.title, p.summary, p.icon_url, p.downloads, p.followers, p.updated_at, p.tags, p.project_type
            FROM organization_projects op
            INNER JOIN projects p ON p.id COLLATE utf8mb4_unicode_ci = op.project_id COLLATE utf8mb4_unicode_ci
            WHERE op.organization_id = ?
            ${canViewAllOrganizationProjects ? "" : "AND p.status = 'approved'"}
            ORDER BY p.updated_at DESC`,
            [organization.id]
        );

        return res.json({
            organization: {
                ...buildOrganizationSummary(organization),
                owner_user_id: organization.owner_user_id,
                created_at: organization.created_at,
                updated_at: organization.updated_at,
            },
            members: members.map(getMemberView),
            projects: projects.map((project) => ({
                ...project,
                tags: project.tags ? String(project.tags).split(",").map((tag) => tag.trim()).filter(Boolean) : [],
            })),
            my_permissions: viewerAccess ? {
                is_owner: viewerAccess.isOwner,
                project_permissions: Array.from(viewerAccess.projectPermissions),
                organization_permissions: Array.from(viewerAccess.organizationPermissions),
            } : null,
        });
    } catch (error) {
        console.error("Error fetching organization:", error);
        return res.status(500).json({ message: "Error fetching organization" });
    }
});

router.get("/:slug/settings", auth, async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const access = await getOrganizationMemberAccess(db, organization.id, req.user.id);
        if(!access) {
            return res.status(403).json({ message: "Access denied" });
        }

        const [members] = await db.query(
            `SELECT
            om.user_id,
            om.role,
            om.status,
            om.project_permissions,
            om.organization_permissions,
            u.username,
            u.slug,
            u.avatar,
            u.isVerified
            FROM organization_members om
            INNER JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = ?
            ORDER BY (om.user_id = ?) DESC, om.created_at ASC`,
            [organization.id, organization.owner_user_id]
        );

        const [pendingInvites] = await db.query(
            `SELECT oi.id, oi.invited_user_id, oi.invited_by_user_id, oi.role,
            oi.project_permissions, oi.organization_permissions, oi.created_at,
            u.username, u.slug, u.avatar, u.isVerified
            FROM organization_invitations oi
            INNER JOIN users u ON u.id = oi.invited_user_id
            WHERE oi.organization_id = ? AND oi.status = 'pending'
            ORDER BY oi.created_at DESC`,
            [organization.id]
        );

        const [projects] = await db.query(
            `SELECT p.id, p.slug, p.title, p.summary, p.icon_url
            FROM organization_projects op
            INNER JOIN projects p ON p.id COLLATE utf8mb4_unicode_ci = op.project_id COLLATE utf8mb4_unicode_ci
            WHERE op.organization_id = ?
            ORDER BY p.updated_at DESC`,
            [organization.id]
        );

        return res.json({
            organization: {
                ...buildOrganizationSummary(organization),
                owner_user_id: organization.owner_user_id,
                created_at: organization.created_at,
                updated_at: organization.updated_at,
            },
            members: members.map(getMemberView),
            pending_invites: pendingInvites.map((invite) => ({
                id: invite.id,
                user_id: invite.invited_user_id,
                username: invite.username,
                slug: invite.slug,
                avatar: invite.avatar,
                isVerified: invite.isVerified,
                role: invite.role,
                project_permissions: parsePermissions(invite.project_permissions),
                organization_permissions: parsePermissions(invite.organization_permissions),
                created_at: invite.created_at,
            })),
            projects,
            my_permissions: {
                user_id: req.user.id,
                is_owner: access.isOwner,
                project_permissions: Array.from(access.projectPermissions),
                organization_permissions: Array.from(access.organizationPermissions),
            },
        });
    } catch (error) {
        console.error("Error fetching organization settings:", error);
        return res.status(500).json({ message: "Error fetching organization settings" });
    }
});

router.put("/:slug/settings", auth, async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const access = await getOrganizationMemberAccess(db, organization.id, req.user.id);
        if(!access || !hasOrganizationPermission(access, ORG_PERMISSIONS.EDIT_DETAILS)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const updates = {};

        if(req.body?.name !== undefined) {
            const nextName = sanitizePlainText(req.body.name || "");
            if(!nextName) {
                return res.status(400).json({ message: "Name cannot be empty" });
            }
            updates.name = nextName;
        }

        if(req.body?.summary !== undefined) {
            const nextSummary = sanitizePlainText(req.body.summary || "", { preserveNewlines: true });
            if(!nextSummary) {
                return res.status(400).json({ message: "Summary cannot be empty" });
            }
            updates.summary = nextSummary;
        }

        if(req.body?.icon_url !== undefined) {
            updates.icon_url = sanitizePlainText(req.body.icon_url || "") || "https://media.modifold.com/static/no-project-icon.svg";
        }

        if(req.body?.slug !== undefined) {
            const currentSlug = String(organization.slug || "").toLowerCase();
            const nextSlug = normalizeSlugInput(req.body.slug || "");

            if(nextSlug !== currentSlug) {
                const validation = validateSlug(nextSlug);
                if(!validation.valid) {
                    return res.status(400).json({ message: getSlugValidationMessage(validation.reason), code: validation.reason });
                }

                const [slugRows] = await db.query("SELECT 1 FROM organizations WHERE slug = ? AND id <> ? LIMIT 1", [validation.normalized, organization.id]);
                if(slugRows.length > 0) {
                    return res.status(400).json({ message: "This URL is already taken", code: "slug_taken" });
                }

                updates.slug = validation.normalized;
            }
        }

        if(Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No changes provided" });
        }

        updates.updated_at = Math.floor(Date.now() / 1000);
        await db.query("UPDATE organizations SET ? WHERE id = ?", [updates, organization.id]);

        await logOrganizationAudit(db, {
            organizationId: organization.id,
            actorUserId: req.user.id,
            action: "organization_updated",
            targetType: "organization",
            targetId: organization.id,
            metadata: { updated_fields: Object.keys(updates) },
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Error updating organization settings:", error);
        return res.status(500).json({ message: "Error updating organization" });
    }
});

router.put("/:slug/links", auth, async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const access = await getOrganizationMemberAccess(db, organization.id, req.user.id);
        if(!access || !hasOrganizationPermission(access, ORG_PERMISSIONS.EDIT_DETAILS)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const updates = {};
        const { discord_url, website_url, twitter_url, bluesky_url, telegram_url, youtube_url } = req.body || {};

        if(discord_url !== undefined) {
            const result = sanitizeOptionalOrganizationLink(discord_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Discord URL" });
            }
            updates.discord_url = result.value;
        }

        if(website_url !== undefined) {
            const result = sanitizeOptionalOrganizationLink(website_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Website URL" });
            }
            updates.website_url = result.value;
        }

        if(twitter_url !== undefined) {
            const result = sanitizeOptionalOrganizationLink(twitter_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Twitter URL" });
            }
            updates.twitter_url = result.value;
        }

        if(bluesky_url !== undefined) {
            const result = sanitizeOptionalOrganizationLink(bluesky_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Bluesky URL" });
            }
            updates.bluesky_url = result.value;
        }

        if(telegram_url !== undefined) {
            const result = sanitizeOptionalOrganizationLink(telegram_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid Telegram URL" });
            }
            updates.telegram_url = result.value;
        }

        if(youtube_url !== undefined) {
            const result = sanitizeOptionalOrganizationLink(youtube_url);
            if(result.invalid) {
                return res.status(400).json({ message: "Invalid YouTube URL" });
            }
            updates.youtube_url = result.value;
        }

        if(Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No data to update" });
        }

        updates.updated_at = Math.floor(Date.now() / 1000);
        await db.query("UPDATE organizations SET ? WHERE id = ?", [updates, organization.id]);

        await logOrganizationAudit(db, {
            organizationId: organization.id,
            actorUserId: req.user.id,
            action: "organization_links_updated",
            targetType: "organization",
            targetId: organization.id,
            metadata: { updated_fields: Object.keys(updates) },
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Error updating organization links:", error);
        return res.status(500).json({ message: "Error updating organization links" });
    }
});

router.put("/:slug/icon", auth, upload.single("icon"), async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const access = await getOrganizationMemberAccess(db, organization.id, req.user.id);
        if(!access || !hasOrganizationPermission(access, ORG_PERMISSIONS.EDIT_DETAILS)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if(!req.file) {
            return res.status(400).json({ message: "No icon uploaded" });
        }

        const mime = String(req.file.mimetype || "").toLowerCase();
        const dirPath = path.join(process.env.MEDIA_ROOT, "organizations", organization.id);
        await fs.mkdir(dirPath, { recursive: true });

        let fileName;
        if(mime === "image/gif") {
            fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.gif`;
            await fs.writeFile(path.join(dirPath, fileName), req.file.buffer);
        } else {
            fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
            const outputBuffer = await sharp(req.file.buffer).rotate().webp({ quality: 82, effort: 4 }).toBuffer();
            await fs.writeFile(path.join(dirPath, fileName), outputBuffer);
        }

        const iconUrl = `https://media.modifold.com/organizations/${organization.id}/${fileName}`;
        await db.query(
            "UPDATE organizations SET icon_url = ?, updated_at = ? WHERE id = ?",
            [iconUrl, Math.floor(Date.now() / 1000), organization.id]
        );

        await logOrganizationAudit(db, {
            organizationId: organization.id,
            actorUserId: req.user.id,
            action: "organization_icon_updated",
            targetType: "organization",
            targetId: organization.id,
            metadata: { icon_url: iconUrl },
        });

        return res.json({ success: true, icon_url: iconUrl });
    } catch (error) {
        console.error("Error uploading organization icon:", error);
        return res.status(500).json({ message: "Error uploading icon" });
    }
});

router.post("/:slug/invites", auth, async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const access = await getOrganizationMemberAccess(db, organization.id, req.user.id);
        if(!access || !hasOrganizationPermission(access, ORG_PERMISSIONS.MANAGE_INVITES)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const invitedSlug = sanitizePlainText(req.body?.slug || "");
        if(!invitedSlug) {
            return res.status(400).json({ message: "User slug is required" });
        }

        const [userRows] = await db.query(
            "SELECT id, username, slug FROM users WHERE slug = ? LIMIT 1",
            [invitedSlug]
        );

        if(userRows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const invitedUser = userRows[0];
        if(Number(invitedUser.id) === Number(req.user.id)) {
            return res.status(400).json({ message: "Cannot invite yourself" });
        }

        const [memberRows] = await db.query(
            "SELECT status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1",
            [organization.id, invitedUser.id]
        );

        if(memberRows.length > 0 && memberRows[0].status === "accepted") {
            return res.status(400).json({ message: "User is already a member" });
        }

        const now = Math.floor(Date.now() / 1000);
        const role = sanitizePlainText(req.body?.role || "Member") || "Member";
        const projectPermissions = Array.isArray(req.body?.project_permissions) ? req.body.project_permissions.filter((item) => typeof item === "string") : DEFAULT_MEMBER_PROJECT_PERMISSIONS;
        const organizationPermissions = Array.isArray(req.body?.organization_permissions) ? req.body.organization_permissions.filter((item) => typeof item === "string") : DEFAULT_MEMBER_ORGANIZATION_PERMISSIONS;

        await db.query(
            `INSERT INTO organization_invitations
            (organization_id, invited_user_id, invited_by_user_id, role, project_permissions, organization_permissions, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            ON DUPLICATE KEY UPDATE
            invited_by_user_id = VALUES(invited_by_user_id),
            role = VALUES(role),
            project_permissions = VALUES(project_permissions),
            organization_permissions = VALUES(organization_permissions),
            updated_at = VALUES(updated_at),
            status = 'pending'`,
            [
                organization.id,
                invitedUser.id,
                req.user.id,
                role,
                JSON.stringify(projectPermissions),
                JSON.stringify(organizationPermissions),
                now,
                now,
            ]
        );

        await db.query(
            `INSERT INTO notification_events
            (recipient_user_id, actor_user_id, event_type, object_type, object_id, created_at)
            VALUES (?, ?, 'organization_invite', 'organization', ?, ?)
            ON DUPLICATE KEY UPDATE
            created_at = VALUES(created_at),
            read_at = NULL`,
            [invitedUser.id, req.user.id, organization.id, now]
        );

        await logOrganizationAudit(db, {
            organizationId: organization.id,
            actorUserId: req.user.id,
            action: "organization_member_invited",
            targetType: "user",
            targetId: String(invitedUser.id),
            metadata: {
                role,
                project_permissions: projectPermissions,
                organization_permissions: organizationPermissions,
            },
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Error inviting organization member:", error);
        return res.status(500).json({ message: "Error inviting member" });
    }
});

router.put("/:slug/members/:userId", auth, async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const access = await getOrganizationMemberAccess(db, organization.id, req.user.id);
        if(!access || !hasOrganizationPermission(access, ORG_PERMISSIONS.MANAGE_MEMBERS)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const targetUserId = Number(req.params.userId);
        if(!Number.isFinite(targetUserId)) {
            return res.status(400).json({ message: "Invalid user id" });
        }

        const [memberRows] = await db.query(
            "SELECT user_id FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1",
            [organization.id, targetUserId]
        );

        if(memberRows.length === 0) {
            return res.status(404).json({ message: "Member not found" });
        }

        const isOwnerMember = Number(targetUserId) === Number(organization.owner_user_id);
        if(isOwnerMember && (req.body?.project_permissions !== undefined || req.body?.organization_permissions !== undefined || req.body?.status !== undefined)) {
            return res.status(400).json({ message: "Cannot update organization owner permissions" });
        }

        const updates = {};
        if(req.body?.role !== undefined) {
            updates.role = sanitizePlainText(req.body.role || "Member") || "Member";
        }

        if(req.body?.project_permissions !== undefined) {
            updates.project_permissions = JSON.stringify(
                Array.isArray(req.body.project_permissions) ? req.body.project_permissions.filter((item) => typeof item === "string") : []
            );
        }

        if(req.body?.organization_permissions !== undefined) {
            updates.organization_permissions = JSON.stringify(
                Array.isArray(req.body.organization_permissions) ? req.body.organization_permissions.filter((item) => typeof item === "string") : []
            );
        }

        if(req.body?.status !== undefined) {
            const nextStatus = String(req.body.status);
            if(!["invited", "accepted", "declined"].includes(nextStatus)) {
                return res.status(400).json({ message: "Invalid status" });
            }
            updates.status = nextStatus;
        }

        if(Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No changes provided" });
        }

        updates.updated_at = Math.floor(Date.now() / 1000);

        await db.query(
            "UPDATE organization_members SET ? WHERE organization_id = ? AND user_id = ?",
            [updates, organization.id, targetUserId]
        );

        await logOrganizationAudit(db, {
            organizationId: organization.id,
            actorUserId: req.user.id,
            action: "organization_member_updated",
            targetType: "user",
            targetId: String(targetUserId),
            metadata: { updated_fields: Object.keys(updates) },
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Error updating organization member:", error);
        return res.status(500).json({ message: "Error updating member" });
    }
});

router.delete("/:slug/members/:userId", auth, async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const targetUserId = Number(req.params.userId);
        const isSelf = Number(req.user.id) === targetUserId;
        const access = await getOrganizationMemberAccess(db, organization.id, req.user.id);

        if(!access) {
            return res.status(403).json({ message: "Access denied" });
        }

        if(!isSelf && !hasOrganizationPermission(access, ORG_PERMISSIONS.MANAGE_MEMBERS)) {
            return res.status(403).json({ message: "Access denied" });
        }

        if(Number(organization.owner_user_id) === targetUserId) {
            return res.status(400).json({ message: "Cannot remove organization owner" });
        }

        await db.query(
            "DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?",
            [organization.id, targetUserId]
        );

        if(!isSelf) {
            const now = Math.floor(Date.now() / 1000);
            await db.query(
                `INSERT INTO notification_events
                (recipient_user_id, actor_user_id, event_type, object_type, object_id, created_at)
                VALUES (?, ?, 'organization_member_removed', 'organization', ?, ?)
                ON DUPLICATE KEY UPDATE
                created_at = VALUES(created_at),
                read_at = NULL`,
                [targetUserId, req.user.id, organization.id, now]
            );
        }

        await logOrganizationAudit(db, {
            organizationId: organization.id,
            actorUserId: req.user.id,
            action: isSelf ? "organization_member_left" : "organization_member_removed",
            targetType: "user",
            targetId: String(targetUserId),
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Error removing organization member:", error);
        return res.status(500).json({ message: "Error removing member" });
    }
});

router.post("/invites/:inviteId/accept", auth, async (req, res) => {
    try {
        const inviteId = Number(req.params.inviteId);
        if(!Number.isFinite(inviteId)) {
            return res.status(400).json({ message: "Invalid invite id" });
        }

        const [inviteRows] = await db.query(
            `SELECT *
            FROM organization_invitations
            WHERE id = ? AND invited_user_id = ? AND status = 'pending'
            LIMIT 1`,
            [inviteId, req.user.id]
        );

        if(inviteRows.length === 0) {
            return res.status(404).json({ message: "Invitation not found" });
        }

        const invite = inviteRows[0];
        const now = Math.floor(Date.now() / 1000);

        await db.query(
            `UPDATE organization_invitations
            SET status = 'declined', updated_at = ?
            WHERE organization_id = ? AND invited_user_id = ? AND status = 'accepted' AND id <> ?`,
            [now, invite.organization_id, invite.invited_user_id, inviteId]
        );

        await db.query(
            `UPDATE organization_invitations
            SET status = 'accepted', updated_at = ?
            WHERE id = ?`,
            [now, inviteId]
        );

        await db.query(
            `INSERT INTO organization_members
            (organization_id, user_id, role, status, project_permissions, organization_permissions, created_at, updated_at)
            VALUES (?, ?, ?, 'accepted', ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            role = VALUES(role),
            status = 'accepted',
            project_permissions = VALUES(project_permissions),
            organization_permissions = VALUES(organization_permissions),
            updated_at = VALUES(updated_at)`,
            [
                invite.organization_id,
                invite.invited_user_id,
                invite.role,
                invite.project_permissions,
                invite.organization_permissions,
                now,
                now,
            ]
        );

        await db.query(
            `UPDATE notification_events
            SET read_at = ?
            WHERE recipient_user_id = ?
            AND event_type = 'organization_invite'
            AND object_type = 'organization'
            AND object_id = ?`,
            [now, req.user.id, invite.organization_id]
        );

        await logOrganizationAudit(db, {
            organizationId: invite.organization_id,
            actorUserId: req.user.id,
            action: "organization_invite_accepted",
            targetType: "invite",
            targetId: String(inviteId),
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Error accepting organization invite:", error);
        return res.status(500).json({ message: "Error accepting invitation" });
    }
});

router.post("/invites/:inviteId/decline", auth, async (req, res) => {
    try {
        const inviteId = Number(req.params.inviteId);
        if(!Number.isFinite(inviteId)) {
            return res.status(400).json({ message: "Invalid invite id" });
        }

        const now = Math.floor(Date.now() / 1000);

        const [result] = await db.query(
            `UPDATE organization_invitations
            SET status = 'declined', updated_at = ?
            WHERE id = ? AND invited_user_id = ? AND status = 'pending'`,
            [now, inviteId, req.user.id]
        );

        if(!result.affectedRows) {
            return res.status(404).json({ message: "Invitation not found" });
        }

        const [inviteRows] = await db.query(
            "SELECT organization_id FROM organization_invitations WHERE id = ? LIMIT 1",
            [inviteId]
        );

        const organizationId = inviteRows[0]?.organization_id;
        if(organizationId) {
            await logOrganizationAudit(db, {
                organizationId,
                actorUserId: req.user.id,
                action: "organization_invite_declined",
                targetType: "invite",
                targetId: String(inviteId),
            });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Error declining organization invite:", error);
        return res.status(500).json({ message: "Error declining invitation" });
    }
});

router.delete("/:slug", auth, async (req, res) => {
    try {
        const organization = await getOrganizationBySlug(req.params.slug);
        if(!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const access = await getOrganizationMemberAccess(db, organization.id, req.user.id);
        if(!access || !hasOrganizationPermission(access, ORG_PERMISSIONS.DELETE_ORGANIZATION)) {
            return res.status(403).json({ message: "Access denied" });
        }

        await logOrganizationAudit(db, {
            organizationId: organization.id,
            actorUserId: req.user.id,
            action: "organization_deleted",
            targetType: "organization",
            targetId: organization.id,
        });

        await db.query("DELETE FROM organizations WHERE id = ?", [organization.id]);

        return res.json({ success: true });
    } catch (error) {
        console.error("Error deleting organization:", error);
        return res.status(500).json({ message: "Error deleting organization" });
    }
});

module.exports = router;