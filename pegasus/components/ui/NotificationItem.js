"use client";

import Link from "next/link";
import UserName from "@/components/ui/UserName";
import { getProjectPath } from "@/utils/projectRoutes";

const ProjectLink = ({ project, children }) => (
    project?.slug ? (
        <Link href={getProjectPath(project)} className="notification-item__project-link"><b>{children}</b></Link>
    ) : (
        <b>{children}</b>
    )
);

const OrganizationLink = ({ organization, children }) => (
    organization?.slug ? (
        <Link href={`/organization/${organization.slug}`}><b>{children}</b></Link>
    ) : (
        <b>{children}</b>
    )
);

const PROJECT_IMAGE_EVENT_TYPES = new Set(["project_approved", "project_rejected", "project_version_approved", "project_version_rejected"]);

function getNotificationProject(notification) {
    if(notification.objectType === "project") {
        return notification.project || null;
    }

    if(notification.objectType === "project_version") {
        return notification.projectVersion?.project || null;
    }

    return null;
}

function NotificationText({ notification, t }) {
    const firstActor = notification.actors?.[0];
    const firstActorView = firstActor ? (
        firstActor.slug ? (
            <Link href={`/user/${firstActor.slug}`} className="notification-item__actor-link"><b><UserName user={firstActor} /></b></Link>
        ) : (
            <b><UserName user={firstActor} /></b>
        )
    ) : <b>{t("unknownUser")}</b>;
    const othersCount = Math.max(0, (notification.totalCount || 0) - 1);

    if(notification.eventType === "follow") {
        return (
            <>
                {firstActorView} {othersCount > 0 ? t("messages.followManyTail", { count: othersCount }) : t("messages.followOneTail")}
            </>
        );
    }

    if(notification.eventType === "project_like") {
        const projectTitle = notification.project?.title || t("messages.projectFallback");

        return (
            <>
                {firstActorView} {othersCount > 0 ? t("messages.projectLikeManyMiddle", { count: othersCount }) : t("messages.projectLikeOneMiddle")} <ProjectLink project={notification.project}>{projectTitle}</ProjectLink>
            </>
        );
    }

    if(notification.eventType === "project_version_release") {
        const versionProject = notification.projectVersion?.project || null;
        const projectTitle = versionProject?.title || t("messages.projectFallback");
        const versionNumber = notification.projectVersion?.versionNumber || t("messages.versionFallback");

        return (
            <>
                {firstActorView} {t("messages.projectVersionReleaseMiddle", { version: versionNumber })} <ProjectLink project={versionProject}>{projectTitle}</ProjectLink>
            </>
        );
    }

    if(notification.eventType === "project_release") {
        const projectTitle = notification.project?.title || t("messages.projectFallback");

        return (
            <>
                {firstActorView} {t("messages.projectReleaseMiddle")} <ProjectLink project={notification.project}>{projectTitle}</ProjectLink>
            </>
        );
    }

    if(notification.eventType === "project_approved") {
        const projectTitle = notification.project?.title || t("messages.projectFallback");

        return (
            <>
                {t("messages.projectApprovedMiddle")} <ProjectLink project={notification.project}>{projectTitle}</ProjectLink>
            </>
        );
    }

    if(notification.eventType === "project_rejected") {
        const projectTitle = notification.project?.title || t("messages.projectFallback");

        return (
            <>
                {t("messages.projectRejectedMiddle")} <ProjectLink project={notification.project}>{projectTitle}</ProjectLink>
            </>
        );
    }

    if(notification.eventType === "project_version_approved") {
        const versionProject = notification.projectVersion?.project || null;
        const projectTitle = versionProject?.title || t("messages.projectFallback");
        const versionNumber = notification.projectVersion?.versionNumber || t("messages.versionFallback");

        return (
            <>
                {t("messages.projectVersionApprovedMiddle", { version: versionNumber })} <ProjectLink project={versionProject}>{projectTitle}</ProjectLink>
            </>
        );
    }

    if(notification.eventType === "project_version_rejected") {
        const versionProject = notification.projectVersion?.project || null;
        const projectTitle = versionProject?.title || t("messages.projectFallback");
        const versionNumber = notification.projectVersion?.versionNumber || t("messages.versionFallback");

        return (
            <>
                {t("messages.projectVersionRejectedMiddle", { version: versionNumber })} <ProjectLink project={versionProject}>{projectTitle}</ProjectLink>
            </>
        );
    }

    if(notification.eventType === "organization_invite") {
        const organizationName = notification.organization?.name || t("messages.organizationFallback");

        return (
            <>
                {firstActorView} {t("messages.organizationInviteTail")} <OrganizationLink organization={notification.organization}>{organizationName}</OrganizationLink>
            </>
        );
    }

    if(notification.eventType === "organization_member_removed") {
        const organizationName = notification.organization?.name || t("messages.organizationFallback");

        return (
            <>
                {firstActorView} {t("messages.organizationRemovedTail")} <OrganizationLink organization={notification.organization}>{organizationName}</OrganizationLink>
            </>
        );
    }

    return t("messages.unknown");
}

function NotificationIcon({ eventType, clipId }) {
    if(eventType === "project_like") {
        return (
            <svg className="icon icon--tick_filled notification-item__icon notification-item__icon--red" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="8"/><path fill="#fff" d="M3.115 6.122C3.408 5.1 4.262 4.2 5.705 4.2c.87 0 1.469.306 1.887.533.17.093.31.201.408.267.098-.066.238-.174.408-.267.418-.227 1.018-.533 1.888-.533 1.442 0 2.296.9 2.59 1.922.288 1.007.024 2.266-.711 3.145-.678.81-1.56 1.498-2.345 2.019-.394.262-.76.478-1.048.63-.233.122-.508.284-.782.284-.279 0-.547-.16-.782-.285a13 13 0 0 1-1.049-.629c-.785-.521-1.666-1.21-2.344-2.02-.735-.878-1-2.137-.71-3.144"/>
            </svg>
        );
    }

    if(eventType === "project_version_release" || eventType === "project_release") {
        return (
            <svg className="notification-item__icon notification-item__icon--blue" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="8" fill="currentColor"></circle>
                <path d="M5 8h6M8 5v6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"></path>
            </svg>
        );
    }

    if(eventType === "project_approved" || eventType === "project_version_approved") {
        return (
            <svg className="notification-item__icon notification-item__icon--green" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <g clipPath={`url(#${clipId})`}>
                    <path d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16Z" fill="currentColor"></path>
                    <path d="M12 5L6.5 11L4 8.27273" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"></path>
                </g>
                <defs>
                    <clipPath id={clipId}>
                        <rect width="16" height="16" fill="white"></rect>
                    </clipPath>
                </defs>
            </svg>
        );
    }

    if(eventType === "project_rejected" || eventType === "project_version_rejected") {
        return (
            <svg className="notification-item__icon notification-item__icon--red" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="8" fill="currentColor"></circle>
                <path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
        );
    }

    if(eventType === "follow") {
        return (
            <svg className="icon icon--tick_filled notification-item__icon notification-item__icon--blue" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="8"></circle>
                <path fill="#fff" d="M3.603 8.308a.34.34 0 0 1 0-.485l.485-.485c.162-.161.373-.111.52.035L6.51 9.415c.07.07.173.07.242 0l4.674-4.811a.335.335 0 0 1 .484 0l.485.484a.335.335 0 0 1 0 .485L6.857 11.32a.31.31 0 0 1-.242.104.31.31 0 0 1-.242-.104z"></path>
            </svg>
        );
    }

    if(eventType === "organization_invite") {
        return (
            <svg className="notification-item__icon notification-item__icon--blue" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="8" fill="currentColor"></circle>
                <path d="M5.2 8h5.6M8 5.2v5.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
        );
    }

    if(eventType === "organization_member_removed") {
        return (
            <svg className="notification-item__icon notification-item__icon--red" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="8" fill="currentColor"></circle>
                <path d="M5.2 8h5.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"></path>
            </svg>
        );
    }

    return null;
}

function ProjectThumbnail({ project }) {
    if(!project?.iconUrl) {
        return null;
    }

    const image = <img src={project.iconUrl} alt={project.title} className="notification-project-thumb" loading="lazy" />;

    return (
        <div className="notification-item__etc">
            {project.slug ? (
                <Link href={getProjectPath(project)}>
                    {image}
                </Link>
            ) : image}
        </div>
    );
}

function ProjectAvatar({ project }) {
    if(!project?.iconUrl) {
        return null;
    }

    const image = <img src={project.iconUrl} alt={project.title || ""} className="notification-avatars-stack__avatar" loading="lazy" />;

    return project.slug ? (
        <Link href={getProjectPath(project)} className="notification-avatars-stack__item">
            {image}
        </Link>
    ) : (
        <span className="notification-avatars-stack__item">
            {image}
        </span>
    );
}

export default function NotificationItem({ notification, timeFormatter, t, onOrganizationInviteAction, isInviteActionPending = false }) {
    const approvedIconClipId = `notification-approved-icon-${notification.id}`;
    const thumbnailProject = notification.eventType === "project_like" ? notification.project : notification.eventType === "project_version_release" ? notification.projectVersion?.project : null;
    const notificationProject = getNotificationProject(notification);
    const shouldShowProjectAvatar = PROJECT_IMAGE_EVENT_TYPES.has(notification.eventType) && notificationProject?.iconUrl;

    return (
        <div className="notification-item">
            <div className="notification-item__image">
                <div className="notification-avatars-stack">
                    {shouldShowProjectAvatar ? (
                        <ProjectAvatar project={notificationProject} />
                    ) : notification.actors?.slice(0, 3).map((actor) => (
                        actor.slug ? (
                            <Link key={actor.id} href={`/user/${actor.slug}`} className="notification-avatars-stack__item">
                                <img src={actor.avatar || "https://media.modifold.com/static/no-project-icon.svg"} alt={actor.username} className="notification-avatars-stack__avatar" loading="lazy" />
                            </Link>
                        ) : (
                            <span key={actor.id} className="notification-avatars-stack__item">
                                <img src={actor.avatar || "https://media.modifold.com/static/no-project-icon.svg"} alt={actor.username} className="notification-avatars-stack__avatar" loading="lazy" />
                            </span>
                        )
                    ))}

                    <NotificationIcon eventType={notification.eventType} clipId={approvedIconClipId} />
                </div>
            </div>

            <div className="notification-item__body">
                <div className="notification-item__text"><NotificationText notification={notification} t={t} /></div>
                <div className="notification-item__date">
                    {timeFormatter.format(new Date((notification.latestAt || 0) * 1000))}
                </div>
            </div>

            <ProjectThumbnail project={thumbnailProject} />

            {notification.eventType === "organization_invite" && notification.inviteId && (
                <div className="notification-item__actions">
                    <button className="button button--size-s button--type-primary" onClick={() => onOrganizationInviteAction(notification, "accept")} disabled={isInviteActionPending}>
                        {t("actions.accept")}
                    </button>

                    <button className="button button--size-s button--type-secondary" onClick={() => onOrganizationInviteAction(notification, "decline")} disabled={isInviteActionPending}>
                        {t("actions.decline")}
                    </button>
                </div>
            )}
        </div>
    );
}