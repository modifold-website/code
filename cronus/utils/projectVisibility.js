const VISIBLE_VERSION_STATUSES = Object.freeze(["approved"]);
const PRIVATE_VERSION_STATUSES = Object.freeze(["draft", "pending", "scanning", "needs_review", "blocked", "error"]);
const PRIVILEGED_USER_ROLES = new Set(["admin", "moderator"]);

const isPrivilegedUserRole = (role) => PRIVILEGED_USER_ROLES.has(String(role || "").toLowerCase());

const canAccessPrivateProject = ({ project, userId, userRole, access }) => {
	if(project?.visibility !== "private") {
		return true;
	}

	if(!userId) {
		return false;
	}

	return Boolean(
		isPrivilegedUserRole(userRole)
		|| access?.isOwner
		|| access?.hasDirectAccess
		|| access?.hasOrganizationAccess
	);
};

const canViewPrivateProjectVersions = ({ userId, userRole, access, hasManageVersionsPermission }) => {
	if(!userId) {
		return false;
	}

	return Boolean(
		isPrivilegedUserRole(userRole)
		|| access?.isOwner
		|| hasManageVersionsPermission
	);
};

const buildVisibleVersionWhereClause = (canViewPrivateVersions) => {
	if(canViewPrivateVersions) {
		const statuses = [...VISIBLE_VERSION_STATUSES, ...PRIVATE_VERSION_STATUSES];
		return {
			sql: `v.moderation_status IN (${statuses.map(() => "?").join(", ")})`,
			params: statuses,
		};
	}

	return {
		sql: "v.moderation_status = ?",
		params: [...VISIBLE_VERSION_STATUSES],
	};
};

module.exports = {
	PRIVATE_VERSION_STATUSES,
	VISIBLE_VERSION_STATUSES,
	buildVisibleVersionWhereClause,
	canAccessPrivateProject,
	canViewPrivateProjectVersions,
	isPrivilegedUserRole,
};