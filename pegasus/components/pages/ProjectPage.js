"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useAuth } from "../providers/AuthProvider";
import ProjectSidebar from "../project/ProjectSidebar";
import ProjectInlineGallerySlider from "../project/ProjectInlineGallerySlider";
import ProjectStatusBanner from "../ui/ProjectStatusBanner";
import { prepareProjectDescriptionMarkdown } from "@/utils/projectDescriptionContent";
import { projectDescriptionMarkdownComponents } from "@/utils/projectDescriptionMarkdownComponents";
import { getProjectPath } from "@/utils/projectRoutes";
import { useTranslations } from "next-intl";

const MODERATION_PROJECT_STATUSES = new Set(["queued", "pending", "in_review"]);

const getProjectStatusBannerType = (status) => {
    if(status === "draft") {
        return "draft";
    }

    if(MODERATION_PROJECT_STATUSES.has(status)) {
        return "moderation";
    }

    return null;
};

const hasProjectEditPermission = (permissions = {}) => Boolean(
    permissions.can_edit ||
    permissions.can_edit_details ||
    permissions.can_edit_body ||
    permissions.can_edit_gallery ||
	permissions.can_manage_versions ||
	permissions.can_manage_collaborators ||
	permissions.can_view_analytics ||
	permissions.can_delete_project
);

export default function ProjectPage({ project, authToken, showInlineGallery = false }) {
    const { user } = useAuth();
    const t = useTranslations("ProjectPage");
    const safeDescription = prepareProjectDescriptionMarkdown(project.description);
    const hasDescription = Boolean(safeDescription);
    const bannerType = getProjectStatusBannerType(project.status);
    const isProjectAuthor = Boolean(user?.id && Number(project.user_id) === Number(user.id));
    const showStatusBanner = Boolean(bannerType && (isProjectAuthor || hasProjectEditPermission(project.permissions)));
    const moderationSettingsHref = getProjectPath(project, "/settings/moderation");

    return (
        <>
            <div className="project__general">
                <div>
                    {showStatusBanner ? (
                        <ProjectStatusBanner type={bannerType} settingsHref={moderationSettingsHref} />
                    ) : null}

                    {showInlineGallery ? (
                        <ProjectInlineGallerySlider images={project?.gallery || []} projectTitle={project?.title || ""} trailerVideoId={project?.trailer_youtube_video_id || ""} />
                    ) : null}

                    <div className="content content--padding markdown-body">
                        {hasDescription ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={projectDescriptionMarkdownComponents}>
                                {safeDescription}
                            </ReactMarkdown>
                        ) : (
                            <div className="subsite-empty-feed">
                                <img src="/images/kweebec.png" style={{ width: "200px" }} alt="" />
                                
                                <p className="subsite-empty-feed__title">{t("emptyDescription")}</p>
                            </div>
                        )}
                    </div>
                </div>

                <ProjectSidebar project={project} authToken={authToken} />
            </div>
        </>
    );
}