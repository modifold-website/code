"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { getProjectBasePath } from "@/utils/projectRoutes";

export default function ProjectTabs({ project }) {
    const t = useTranslations("ProjectPage");
    const pathname = usePathname();
    const tabsRef = useRef(null);
    const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0, opacity: 0 });
    const basePath = getProjectBasePath(project?.project_type);
    const [issuesCount, setIssuesCount] = useState(null);
    const showIssuesTab = project?.issues_enabled;

    const isActive = (href) => pathname === href;
    const isVersionsActive = pathname === `${basePath}/${project.slug}/versions` || pathname.startsWith(`${basePath}/${project.slug}/version/`);
    const isWikiActive = pathname === `${basePath}/${project.slug}/wiki` || pathname.startsWith(`${basePath}/${project.slug}/wiki/`);
    const isIssuesActive = pathname === `${basePath}/${project.slug}/issues` || pathname.startsWith(`${basePath}/${project.slug}/issues/`);

    const formatCount = (value) => {
        if(!Number.isFinite(value)) {
            return null;
        }

        if(value < 1000) {
            return String(value);
        }

        if(value < 1000000) {
            const next = value / 1000;
            const fixed = next < 10 ? next.toFixed(1) : Math.round(next).toString();
            return `${fixed.replace(/\.0$/, "")}k`;
        }

        const next = value / 1000000;
        const fixed = next < 10 ? next.toFixed(1) : Math.round(next).toString();
        return `${fixed.replace(/\.0$/, "")}m`;
    };

    useEffect(() => {
        if(!project?.slug || !showIssuesTab) {
            setIssuesCount(null);
            return;
        }

        const controller = new AbortController();
        const loadCount = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/issues?status=all&limit=1`, {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                if(!res.ok) {
                    setIssuesCount(null);
                    return;
                }

                const data = await res.json();
                setIssuesCount(Number(data.totalCount ?? data.total_count ?? data.count ?? 0));
            } catch (error) {
                if(error.name !== "AbortError") {
                    setIssuesCount(null);
                }
            }
        };

        loadCount();
        return () => controller.abort();
    }, [project?.slug, showIssuesTab]);

    useLayoutEffect(() => {
        const updateIndicator = () => {
            const container = tabsRef.current;
            if(!container) {
                return;
            }

            const activeTab = container.querySelector(".tabs__tab--active");
            if(!activeTab) {
                setIndicatorStyle({ width: 0, left: 0, opacity: 0 });
                return;
            }

            const left = activeTab.offsetLeft;
            const width = activeTab.offsetWidth;
            setIndicatorStyle({ width, left, opacity: 1 });
        };

        const raf = requestAnimationFrame(updateIndicator);
        window.addEventListener("resize", updateIndicator);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", updateIndicator);
        };
    }, [pathname, issuesCount, project?.gallery?.length, project?.trailer_youtube_video_id, project?.hytale_wiki_slug, showIssuesTab]);

    return (
        <div className="tabs" ref={tabsRef} style={{ paddingLeft: "16px", "--40010a00": "46px", "--58752bc5": "0px", "--b2a58f2e": "0" }}>
            <Link href={`${basePath}/${project.slug}`} scroll={false} className={`tabs__tab ${isActive(`${basePath}/${project.slug}`) ? "tabs__tab--active" : ""}`}>
                {t("tabs.description")}
            </Link>

            <Link href={`${basePath}/${project.slug}/versions`} scroll={false} className={`tabs__tab ${isVersionsActive ? "tabs__tab--active" : ""}`}>
                {t("tabs.versions")}
            </Link>
        
            {(project?.gallery?.length > 0 || project?.trailer_youtube_video_id) && (
                <Link href={`${basePath}/${project.slug}/gallery`} scroll={false} className={`tabs__tab ${isActive(`${basePath}/${project.slug}/gallery`) ? "tabs__tab--active" : ""}`}>
                    {t("tabs.gallery")}
                </Link>
            )}

            {project.hytale_wiki_slug && (
                <Link href={`${basePath}/${project.slug}/wiki`} scroll={false} className={`tabs__tab ${isWikiActive ? "tabs__tab--active" : ""}`}>
                    {t("wiki")}
                </Link>
            )}

            {showIssuesTab && (
                <Link href={`${basePath}/${project.slug}/issues`} scroll={false} className={`tabs__tab ${isIssuesActive ? "tabs__tab--active" : ""}`}>
                    {t("tabs.issues")}
                    
                    {issuesCount > 0 && (
                        <span className="tabs__count">{formatCount(issuesCount)}</span>
                    )}
                </Link>
            )}

            <span className="tabs__indicator" aria-hidden="true" style={{ width: `${indicatorStyle.width}px`, transform: `translateX(${indicatorStyle.left}px)`, opacity: indicatorStyle.opacity }} />
        </div>
    );
}