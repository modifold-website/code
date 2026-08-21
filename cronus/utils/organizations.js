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

// a fucking disaster
const ORG_OWNER_PROJECT_PERMISSIONS = Object.values(ORG_PROJECT_PERMISSIONS);
const ORG_OWNER_ORGANIZATION_PERMISSIONS = Object.values(ORG_PERMISSIONS);
const PROJECT_COLLABORATOR_PERMISSION_KEYS = {
	EDIT_DETAILS: ORG_PROJECT_PERMISSIONS.EDIT_DETAILS,
	EDIT_BODY: ORG_PROJECT_PERMISSIONS.EDIT_BODY,
	EDIT_GALLERY: ORG_PROJECT_PERMISSIONS.EDIT_GALLERY,
	UPLOAD_VERSION: "project_upload_version",
	EDIT_VERSION: "project_edit_version",
	DELETE_VERSION: "project_delete_version",
	VIEW_ANALYTICS: "project_view_analytics",
	MANAGE_INVITES: "project_manage_invites",
	EDIT_MEMBERS: "project_edit_members",
	REMOVE_MEMBERS: "project_remove_members",
	DELETE_PROJECT: ORG_PROJECT_PERMISSIONS.DELETE_PROJECT,
};
const PROJECT_COLLABORATOR_PERMISSIONS = [
	PROJECT_COLLABORATOR_PERMISSION_KEYS.UPLOAD_VERSION,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.EDIT_VERSION,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.DELETE_VERSION,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.EDIT_DETAILS,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.EDIT_BODY,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.EDIT_GALLERY,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.VIEW_ANALYTICS,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.MANAGE_INVITES,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.REMOVE_MEMBERS,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.EDIT_MEMBERS,
	PROJECT_COLLABORATOR_PERMISSION_KEYS.DELETE_PROJECT,
];
const PROJECT_ACCESS_PERMISSION_SET = new Set([
	...PROJECT_COLLABORATOR_PERMISSIONS,
	ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS,
]);

const PROJECT_PERMISSION_ALIASES = {
	[PROJECT_COLLABORATOR_PERMISSION_KEYS.UPLOAD_VERSION]: [ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS],
	[PROJECT_COLLABORATOR_PERMISSION_KEYS.EDIT_VERSION]: [ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS],
	[PROJECT_COLLABORATOR_PERMISSION_KEYS.DELETE_VERSION]: [ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS],
	[PROJECT_COLLABORATOR_PERMISSION_KEYS.VIEW_ANALYTICS]: [ORG_PROJECT_PERMISSIONS.EDIT_DETAILS],
	[ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS]: [
		PROJECT_COLLABORATOR_PERMISSION_KEYS.UPLOAD_VERSION,
		PROJECT_COLLABORATOR_PERMISSION_KEYS.EDIT_VERSION,
		PROJECT_COLLABORATOR_PERMISSION_KEYS.DELETE_VERSION,
	],
};

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

const expandProjectPermissions = (value) => {
	const permissions = new Set(parsePermissions(value));
	if(permissions.has(ORG_PROJECT_PERMISSIONS.MANAGE_VERSIONS)) {
		permissions.add(PROJECT_COLLABORATOR_PERMISSION_KEYS.UPLOAD_VERSION);
		permissions.add(PROJECT_COLLABORATOR_PERMISSION_KEYS.EDIT_VERSION);
		permissions.add(PROJECT_COLLABORATOR_PERMISSION_KEYS.DELETE_VERSION);
	}

	return Array.from(permissions);
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
			hasDirectAccess: false,
            hasOrganizationAccess: false,
			directMember: null,
            organization: null,
            projectPermissions: new Set(),
            organizationPermissions: new Set(),
        };
    }

    const [projectRows] = await db.query("SELECT user_id FROM projects WHERE id = ? LIMIT 1", [projectId]);
    if(projectRows.length === 0) {
        return {
            isOwner: false,
			hasDirectAccess: false,
            hasOrganizationAccess: false,
			directMember: null,
            organization: null,
            projectPermissions: new Set(),
            organizationPermissions: new Set(),
        };
    }

    if(Number(projectRows[0].user_id) === Number(userId)) {
        return {
            isOwner: true,
			hasDirectAccess: false,
            hasOrganizationAccess: false,
			directMember: null,
            organization: null,
            projectPermissions: new Set(ORG_OWNER_PROJECT_PERMISSIONS),
            organizationPermissions: new Set(ORG_OWNER_ORGANIZATION_PERMISSIONS),
        };
    }

	const [directMemberRows] = await db.query(
		`SELECT id, project_id, user_id, role, status, permissions, invited_by_user_id, created_at, updated_at
		FROM project_members
		WHERE project_id = ? AND user_id = ? AND status IN ('accept', 'accepted')
		LIMIT 1`,
		[projectId, userId]
	);
	const directMember = directMemberRows[0] || null;
	const directPermissions = new Set(
		expandProjectPermissions(directMember?.permissions).filter((permission) => PROJECT_ACCESS_PERMISSION_SET.has(permission))
	);

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
			hasDirectAccess: Boolean(directMember),
            hasOrganizationAccess: false,
			directMember,
            organization: null,
			projectPermissions: directPermissions,
            organizationPermissions: new Set(),
        };
    }

    const organization = organizationRows[0];
    const memberAccess = await getOrganizationMemberAccess(db, organization.id, userId);

    if(!memberAccess) {
        return {
            isOwner: false,
			hasDirectAccess: Boolean(directMember),
            hasOrganizationAccess: false,
			directMember,
            organization,
			projectPermissions: directPermissions,
            organizationPermissions: new Set(),
        };
    }

	const projectPermissions = new Set([
		...directPermissions,
		...memberAccess.projectPermissions,
	]);

    return {
        isOwner: false,
		hasDirectAccess: Boolean(directMember),
        hasOrganizationAccess: true,
		directMember,
        organization,
		projectPermissions,
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

	if(access.projectPermissions.has(permission)) {
		return true;
	}

	return (PROJECT_PERMISSION_ALIASES[permission] || []).some((alias) => access.projectPermissions.has(alias));
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
	PROJECT_COLLABORATOR_PERMISSION_KEYS,
	PROJECT_COLLABORATOR_PERMISSIONS,
    parsePermissions,
	expandProjectPermissions,
    getOrganizationMemberAccess,
    resolveProjectAccess,
    hasProjectPermission,
    hasOrganizationPermission,
    logOrganizationAudit,
};