"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import ProjectSidebar from "../project/ProjectSidebar";
import ProjectInlineGallerySlider from "../project/ProjectInlineGallerySlider";
import { prepareProjectDescriptionMarkdown } from "@/utils/projectDescriptionContent";
import { projectDescriptionMarkdownComponents } from "@/utils/projectDescriptionMarkdownComponents";
import { getProjectPath } from "@/utils/projectRoutes";

export default function ProjectPage({ project, authToken, showInlineGallery = false }) {
    const safeDescription = prepareProjectDescriptionMarkdown(project.description);
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: project.title,
        description: project.summary,
        applicationCategory: "Game",
        operatingSystem: "Hytale",
        author: {
            "@type": project.owner?.type === "organization" ? "Organization" : "Person",
            name: project.owner.username,
            url: `https://modifold.com${project.owner?.profile_url || `/user/${project.owner.slug}`}`,
        },
        datePublished: project.created_at,
        image: project.icon_url,
        url: `https://modifold.com${getProjectPath(project)}`,
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

            <div className="project__general">
                <div>
                    {showInlineGallery && (
                        <ProjectInlineGallerySlider images={project?.gallery || []} projectTitle={project?.title || ""} />
                    )}

                    <div className="content content--padding markdown-body">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={projectDescriptionMarkdownComponents}
                        >
                            {safeDescription}
                        </ReactMarkdown>
                    </div>
                </div>

                <ProjectSidebar project={project} authToken={authToken} />
            </div>
        </>
    );
}