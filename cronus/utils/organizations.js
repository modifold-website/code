const ORG_PROJECT_PERMISSIONS = {
    EDIT_DETAILS: "project_edit_details",
    EDIT_BODY: "project_edit_body",
    EDIT_GALLERY: "project_edit_gallery",
    MANAGE_VERSIONS: "project_manage_versions",
    DELETE_PROJECT: "project_delete",
};

const ORG_PERMISSIONS = {
    EDIT_DETAILS: "organization_edit_details",
    MANAGE_INVITES: "organization_manage_invites",
    MANAGE_MEMBERS: "organization_manage_members",
    ADD_PROJECT: "organization_add_project",
    REMOVE_PROJECT: "organization_remove_project",
    DELETE_ORGANIZATION: "organization_delete",
};

const ORG_OWNER_PROJECT_PERMISSIONS = Object.values(ORG_PROJECT_PERMISSIONS);
const ORG_OWNER_ORGANIZATION_PERMISSIONS = Object.values(ORG_PERMISSIONS);

const parsePermissions = (value, fallback = []) => {
    if(Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if(typeof value !== "string" || value.trim().length === 0) {
        return [...fallback];
    }

    try {
        const parsed = JSON.parse(value);
        if(Array.isArray(parsed)) {
            return parsed.filter(Boolean);
        }
    } catch {}

    return [...fallback];
};

const logOrganizationAudit = async (db, { organizationId, actorUserId, action, targetType = null, targetId = null, metadata = null }) => {
    if(!organizationId || !actorUserId || !action) {
        return;
    }

    try {
        await db.query(
            `INSERT INTO organization_audit_logs
            (organization_id, actor_user_id, action, target_type, target_id, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                organizationId,
                actorUserId,
                action,
                targetType,
                targetId,
                metadata ? JSON.stringify(metadata) : null,
                Math.floor(Date.now() / 1000),
            ]
        );
    } catch (error) {
        console.error("Failed to write organization audit log:", error.message);
    }
};

const getOrganizationMemberAccess = async (db, organizationId, userId) => {
    if(!organizationId || !userId) {
        return null;
    }

    const [rows] = await db.query(
        `SELECT om.*, o.owner_user_id
        FROM organization_members om
        INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = om.organization_id COLLATE utf8mb4_unicode_ci
        WHERE om.organization_id = ? AND om.user_id = ? AND om.status = 'accepted'
        LIMIT 1`,
        [organizationId, userId]
    );

    if(rows.length === 0) {
        return null;
    }

    const row = rows[0];
    const isOwner = Number(row.owner_user_id) === Number(userId);

    return {
        organizationId,
        userId,
        isOwner,
        member: row,
        projectPermissions: new Set(
            isOwner ? ORG_OWNER_PROJECT_PERMISSIONS : parsePermissions(row.project_permissions)
        ),
        organizationPermissions: new Set(
            isOwner ? ORG_OWNER_ORGANIZATION_PERMISSIONS : parsePermissions(row.organization_permissions)
        ),
    };
};

const resolveProjectAccess = async (db, projectId, userId) => {
    if(!projectId || !userId) {
        return {
            isOwner: false,
            hasOrganizationAccess: false,
            organization: null,
            projectPermissions: new Set(),
            organizationPermissions: new Set(),
        };
    }

    const [projectRows] = await db.query("SELECT user_id FROM projects WHERE id = ? LIMIT 1", [projectId]);
    if(projectRows.length === 0) {
        return {
            isOwner: false,
            hasOrganizationAccess: false,
            organization: null,
            projectPermissions: new Set(),
            organizationPermissions: new Set(),
        };
    }

    if(Number(projectRows[0].user_id) === Number(userId)) {
        return {
            isOwner: true,
            hasOrganizationAccess: false,
            organization: null,
            projectPermissions: new Set(ORG_OWNER_PROJECT_PERMISSIONS),
            organizationPermissions: new Set(ORG_OWNER_ORGANIZATION_PERMISSIONS),
        };
    }

    const [organizationRows] = await db.query(
        `SELECT o.id, o.slug, o.name, o.summary, o.icon_url
        FROM organization_projects op
        INNER JOIN organizations o ON o.id COLLATE utf8mb4_unicode_ci = op.organization_id COLLATE utf8mb4_unicode_ci
        WHERE op.project_id = ?
        LIMIT 1`,
        [projectId]
    );

    if(organizationRows.length === 0) {
        return {
            isOwner: false,
            hasOrganizationAccess: false,
            organization: null,
            projectPermissions: new Set(),
            organizationPermissions: new Set(),
        };
    }

    const organization = organizationRows[0];
    const memberAccess = await getOrganizationMemberAccess(db, organization.id, userId);

    if(!memberAccess) {
        return {
            isOwner: false,
            hasOrganizationAccess: false,
            organization,
            projectPermissions: new Set(),
            organizationPermissions: new Set(),
        };
    }

    return {
        isOwner: false,
        hasOrganizationAccess: true,
        organization,
        projectPermissions: memberAccess.projectPermissions,
        organizationPermissions: memberAccess.organizationPermissions,
    };
};

const hasProjectPermission = (access, permission) => {
    if(!access) {
        return false;
    }

    if(access.isOwner) {
        return true;
    }

    return access.projectPermissions.has(permission);
};

const hasOrganizationPermission = (access, permission) => {
    if(!access) {
        return false;
    }

    if(access.isOwner) {
        return true;
    }

    return access.organizationPermissions.has(permission);
};

module.exports = {
    ORG_PERMISSIONS,
    ORG_PROJECT_PERMISSIONS,
    parsePermissions,
    getOrganizationMemberAccess,
    resolveProjectAccess,
    hasProjectPermission,
    hasOrganizationPermission,
    logOrganizationAudit,
};