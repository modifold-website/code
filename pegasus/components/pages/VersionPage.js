"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProjectPath } from "@/utils/projectRoutes";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import VersionDisplay from "../VersionDisplay";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ProjectSidebar from "../project/ProjectSidebar";
import VersionDownloadButton from "../project/VersionDownloadButton";
import Tooltip from "../ui/Tooltip";
import VersionEditMetadataModal from "../../modal/VersionEditMetadataModal";
import VersionEditDetailsModal from "../../modal/VersionEditDetailsModal";
import VersionEditFilesModal from "../../modal/VersionEditFilesModal";
import { DEFAULT_GAME_VERSIONS, normalizeGameVersionItemsPayload } from "@/utils/gameVersions";

const loaders = [
    "Vanilla",
];

const releaseChannels = ["release", "beta", "alpha"];
const dependencyTypes = ["required", "optional", "incompatible", "embedded"];
const VERSION_FILE_ACCEPT = ".jar,.zip,.rar,application/zip, application/x-rar-compressed, application/vnd.rar, application/java-archive";
const MAX_VERSION_FILE_SIZE = 100 * 1024 * 1024;
const EDIT_MODAL_TYPES = {
    METADATA: "metadata",
    DETAILS: "details",
    FILES: "files",
};

const createEmptyDependencyDraft = () => ({
    project_id: "",
    project_slug: "",
    project_title: "",
    project_icon_url: "",
    version_id: "",
    version_number: "",
    dependency_type: "required",
});

const getSafeMarkdownHref = (href) => {
    if(typeof href !== "string") {
        return null;
    }

    if(href.startsWith("/") || href.startsWith("#")) {
        return href;
    }

    try {
        const parsed = new URL(href);
        if(!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
};

const parseList = (value) => {
    if(Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if(typeof value === "string") {
        return value.split(",").map((item) => item.trim()).filter(Boolean);
    }

    return [];
};

const normalizeDependency = (dependency) => {
    if(!dependency || typeof dependency !== "object") {
        return null;
    }

    const projectId = String(dependency.project_id || "").trim();
    const versionId = String(dependency.version_id || "").trim();
    const dependencyType = String(dependency.dependency_type || dependency.type || "required").trim().toLowerCase();
    if(!projectId && !versionId && !dependency.project_slug) {
        return null;
    }

    return {
        project_id: projectId,
        version_id: versionId,
        dependency_type: dependencyTypes.includes(dependencyType) ? dependencyType : "required",
        project_slug: dependency.project_slug ? String(dependency.project_slug).trim() : "",
        project_title: dependency.project_title ? String(dependency.project_title).trim() : "",
        project_icon_url: dependency.project_icon_url ? String(dependency.project_icon_url).trim() : "",
        project_type: dependency.project_type ? String(dependency.project_type).trim() : "",
        version_number: dependency.version_number ? String(dependency.version_number).trim() : "",
        file_name: dependency.file_name ? String(dependency.file_name).trim() : "",
        file_url: dependency.file_url ? String(dependency.file_url).trim() : "",
        file_size: Number.isFinite(dependency.file_size) ? dependency.file_size : Number(dependency.file_size),
    };
};

const parseDependencies = (value) => {
    if(!Array.isArray(value)) {
        return [];
    }

    return value.map((item) => normalizeDependency(item)).filter(Boolean);
};

const getDependencyKey = (dependency) => {
    const projectId = String(dependency?.project_id || dependency?.project_slug || "").trim().toLowerCase();
    const versionId = String(dependency?.version_id || "").trim().toLowerCase();

    return `${projectId}::${versionId || "__project_only__"}`;
};

export default function VersionPage({ project, version, authToken, gameVersions = DEFAULT_GAME_VERSIONS, canEditVersion = false }) {
    const t = useTranslations("ProjectPage");
    const tSettings = useTranslations("SettingsProjectPage");
    const locale = useLocale();
    const router = useRouter();
    const [currentVersion, setCurrentVersion] = useState(version);
    const [openEditActionsVersionId, setOpenEditActionsVersionId] = useState(null);
    const [editModalType, setEditModalType] = useState(null);
    const [editingVersionId, setEditingVersionId] = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [editVersionFile, setEditVersionFile] = useState({ url: "", size: null });
    const [editFormData, setEditFormData] = useState({
        version_number: "",
        changelog: "",
        release_channel: "release",
        game_versions: [],
        loaders: [],
        dependencies: [],
    });
    const [editDependencyDraft, setEditDependencyDraft] = useState(createEmptyDependencyDraft);
    const [isEditGameVersionsPopoverOpen, setIsEditGameVersionsPopoverOpen] = useState(false);
    const [isEditLoadersPopoverOpen, setIsEditLoadersPopoverOpen] = useState(false);
    const editGameVersionsRef = useRef(null);
    const editLoadersRef = useRef(null);

    const gameVersionItems = useMemo(() => normalizeGameVersionItemsPayload({ game_versions: gameVersions }), [gameVersions]);
    const gameVersionNames = useMemo(() => gameVersionItems.map((item) => item.version), [gameVersionItems]);

    useEffect(() => {
        setCurrentVersion(version);
    }, [version]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(editGameVersionsRef.current && !editGameVersionsRef.current.contains(event.target)) {
                setIsEditGameVersionsPopoverOpen(false);
            }

            if(editLoadersRef.current && !editLoadersRef.current.contains(event.target)) {
                setIsEditLoadersPopoverOpen(false);
            }

            if(!event.target.closest(".version-actions")) {
                setOpenEditActionsVersionId(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatRelativeTime = (dateString) => {
        const date = new Date(dateString);
        if(Number.isNaN(date.getTime())) {
            return "";
        }

        const seconds = Math.round((date.getTime() - Date.now()) / 1000);
        const units = [
            ["year", 60 * 60 * 24 * 365],
            ["month", 60 * 60 * 24 * 30],
            ["week", 60 * 60 * 24 * 7],
            ["day", 60 * 60 * 24],
            ["hour", 60 * 60],
            ["minute", 60],
            ["second", 1],
        ];
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        const [unit, divisor] = units.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) || units[units.length - 1];

        return rtf.format(Math.round(seconds / divisor), unit);
    };

    const formatFileSize = (size) => {
        if(!Number.isFinite(size) || size <= 0) {
            return "0 B";
        }

        const units = ["B", "KB", "MB", "GB"];
        const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
        const value = size / (1024 ** unitIndex);
        return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    };

    const getFileNameFromUrl = (url) => {
        if(typeof url !== "string" || !url.trim()) {
            return "";
        }

        try {
            const { pathname } = new URL(url);
            const segments = pathname.split("/").filter(Boolean);
            return decodeURIComponent(segments[segments.length - 1] || "");
        } catch {
            const segments = url.split("/").filter(Boolean);
            return segments[segments.length - 1] || "";
        }
    };

    const getFileTooltip = ({ file, fallbackName, fallbackUrl, fallbackSize }) => {
        const fileName = file?.name || file?.file_name || file?.filename || getFileNameFromUrl(file?.url || file?.file_url || fallbackUrl) || fallbackName || "";
        const fileSize = Number.isFinite(file?.size) ? file.size : (Number.isFinite(file?.file_size) ? file.file_size : fallbackSize);

        if(!fileName) {
            return "";
        }

        if(Number.isFinite(fileSize) && fileSize > 0) {
            return `${fileName} (${formatFileSize(fileSize)})`;
        }

        return fileName;
    };

    const primaryFile = currentVersion.files?.find((file) => file.primary) || currentVersion.files?.[0];
    const versionDisplayName = currentVersion.name || currentVersion.version_number;
    const primaryFileTooltip = getFileTooltip({
        file: primaryFile,
        fallbackName: versionDisplayName,
        fallbackUrl: currentVersion.file_url,
        fallbackSize: Number.isFinite(currentVersion.file_size) ? currentVersion.file_size : Number(currentVersion.file_size),
    });
    const releaseChannel = typeof currentVersion.release_channel === "string" ? currentVersion.release_channel.trim().toLowerCase() : "";
    const hasKnownReleaseChannel = releaseChannels.includes(releaseChannel);
    const releaseChannelLabel = hasKnownReleaseChannel ? t(`versions.channels.${releaseChannel}`) : (currentVersion.release_channel || t("versions.notSpecified"));
    const dependencies = parseDependencies(currentVersion.dependencies);
    const buildDependencyContent = (dependency, index) => {
        const dependencyProject = dependency.project_slug ? { slug: dependency.project_slug, project_type: dependency.project_type } : null;
        const dependencyProjectPath = dependencyProject ? getProjectPath(dependencyProject) : null;
        const dependencyHref = dependencyProjectPath ? (dependency.version_id ? `${dependencyProjectPath}/version/${dependency.version_id}` : dependencyProjectPath) : null;

        return {
            id: `${dependency.project_id || dependency.project_slug || "dependency"}:${dependency.version_id || index}`,
            title: dependency.project_title || dependency.project_slug || dependency.project_id || t("versions.dependencies.unknownDependency"),
            icon: dependency.project_icon_url || "https://media.modifold.com/static/no-project-icon.svg",
            href: dependencyHref,
            downloadHref: dependency.project_slug && dependency.version_id ? `${process.env.NEXT_PUBLIC_API_BASE}/projects/${dependency.project_slug}/versions/${dependency.version_id}/download` : (dependencyProjectPath ? `${dependencyProjectPath}/versions` : null),
            downloadTooltip: getFileTooltip({
                file: {
                    file_name: dependency.file_name,
                    file_url: dependency.file_url,
                    file_size: dependency.file_size,
                },
                fallbackName: dependency.version_number || dependency.project_title || dependency.project_slug,
                fallbackUrl: dependency.file_url,
                fallbackSize: dependency.file_size,
            }),
        };
    };
    const requiredContent = dependencies.filter((dependency) => dependency.dependency_type === "required").map(buildDependencyContent);
    const optionalContent = dependencies.filter((dependency) => dependency.dependency_type === "optional").map(buildDependencyContent);
    const gameVersionList = parseList(currentVersion.game_versions);
    const loaderList = parseList(currentVersion.loaders);
    const hasChangelog = Boolean(currentVersion.changelog);
    const shouldShowEditActions = Boolean(canEditVersion || (authToken && (
        project.permissions?.can_manage_versions ||
        project.permissions?.can_edit_versions ||
        project.permissions?.can_edit ||
        project.permissions?.can_edit_details
    )));

    const refreshVersion = async () => {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/version/${currentVersion.id}`, {
            headers: { Accept: "application/json" },
        });

        setCurrentVersion(res.data);
    };

    const updateDependencyDraft = (setter) => (field, value) => {
        setter((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const addDependencyToForm = ({ draft, formSetter, draftSetter, duplicateMessage }) => {
        const normalized = normalizeDependency(draft);
        if(!normalized) {
            toast.error("Dependency must include Project ID or Version ID.");
            return;
        }

        let wasAdded = false;
        formSetter((prev) => {
            const currentDependencies = Array.isArray(prev.dependencies) ? prev.dependencies : [];
            const nextKey = getDependencyKey(normalized);
            const hasDuplicate = currentDependencies.some((item) => getDependencyKey(item) === nextKey);
            if(hasDuplicate) {
                toast.error(duplicateMessage);
                return prev;
            }

            wasAdded = true;
            return {
                ...prev,
                dependencies: [...currentDependencies, normalized],
            };
        });

        if(wasAdded) {
            draftSetter(createEmptyDependencyDraft());
        }
    };

    const openEditModal = async (versionId, modalType) => {
        const initialGameVersions = parseList(currentVersion.game_versions);
        const initialLoaders = parseList(currentVersion.loaders);
        const initialDependencies = parseDependencies(currentVersion.dependencies);

        setOpenEditActionsVersionId(null);
        setEditingVersionId(versionId);
        setEditLoading(true);
        setEditVersionFile({
            url: currentVersion.file_url || "",
            size: Number.isFinite(currentVersion.file_size) ? currentVersion.file_size : Number(currentVersion.file_size),
        });
        setEditFormData({
            version_number: currentVersion.version_number || "",
            changelog: currentVersion.changelog || "",
            release_channel: currentVersion.release_channel || "release",
            game_versions: initialGameVersions,
            loaders: initialLoaders,
            dependencies: initialDependencies,
        });
        setEditDependencyDraft(createEmptyDependencyDraft());
        setEditModalType(modalType);

        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/version/${versionId}`, {
                headers: { Accept: "application/json" },
            });

            const version = res.data;
            setCurrentVersion(version);
            setEditFormData({
                version_number: version.version_number || "",
                changelog: version.changelog || "",
                release_channel: version.release_channel || "release",
                game_versions: parseList(version.game_versions),
                loaders: parseList(version.loaders),
                dependencies: parseDependencies(version.dependencies),
            });
            setEditVersionFile({
                url: version.file_url || "",
                size: Number.isFinite(version.file_size) ? version.file_size : Number(version.file_size),
            });
        } catch (err) {
            toast.error(err.response?.data?.message || t("errorOccurred"));
            setEditModalType(null);
            setEditingVersionId(null);
        } finally {
            setEditLoading(false);
        }
    };

    const closeEditModal = () => {
        setEditModalType(null);
        setOpenEditActionsVersionId(null);
        setEditingVersionId(null);
        setEditLoading(false);
        setEditVersionFile({ url: "", size: null });
        setIsEditGameVersionsPopoverOpen(false);
        setIsEditLoadersPopoverOpen(false);
        setEditDependencyDraft(createEmptyDependencyDraft());
        setEditFormData({
            version_number: "",
            changelog: "",
            release_channel: "release",
            game_versions: [],
            loaders: [],
            dependencies: [],
        });
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleEditDependencyDraftChange = updateDependencyDraft(setEditDependencyDraft);

    const handleAddEditDependency = () => {
        addDependencyToForm({
            draft: editDependencyDraft,
            formSetter: setEditFormData,
            draftSetter: setEditDependencyDraft,
            duplicateMessage: "This dependency is already in the list.",
        });
    };

    const handleRemoveEditDependency = (indexToRemove) => {
        setEditFormData((prev) => ({
            ...prev,
            dependencies: (prev.dependencies || []).filter((_, index) => index !== indexToRemove),
        }));
    };

    const handleEditToggleGameVersion = (gameVersion) => {
        setEditFormData((prev) => ({
            ...prev,
            game_versions: prev.game_versions.includes(gameVersion) ? prev.game_versions.filter((v) => v !== gameVersion) : [...prev.game_versions, gameVersion],
        }));
    };

    const handleEditToggleLoader = (loader) => {
        setEditFormData((prev) => ({
            ...prev,
            loaders: prev.loaders.includes(loader) ? prev.loaders.filter((l) => l !== loader) : [...prev.loaders, loader],
        }));
    };

    const handleSelectEditReleaseChannel = (channel) => {
        setEditFormData((prev) => ({ ...prev, release_channel: channel }));
    };

    const handleUpdate = async (e, options = {}) => {
        e?.preventDefault?.();
        if(!editingVersionId) {
            return;
        }

        if(editFormData.game_versions.length === 0 || editFormData.loaders.length === 0) {
            toast.error(t("fillRequiredFields"));
            return;
        }

        setEditLoading(true);

        const formDataToSend = new FormData();
        formDataToSend.append("version_number", editFormData.version_number);
        formDataToSend.append("changelog", editFormData.changelog);
        formDataToSend.append("release_channel", editFormData.release_channel);
        formDataToSend.append("game_versions", JSON.stringify(editFormData.game_versions));
        formDataToSend.append("loaders", JSON.stringify(editFormData.loaders));
        formDataToSend.append("dependencies", JSON.stringify((editFormData.dependencies || []).map((dependency) => ({
            slug: dependency.project_slug || "",
            version_id: dependency.version_id || "",
            type: dependency.dependency_type || "required",
        }))));
        const selectedFile = options.file || e?.target?.file?.files?.[0] || null;
        if(selectedFile) {
            formDataToSend.append("file", selectedFile);
        }

        try {
            await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/versions/${editingVersionId}`, formDataToSend, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "multipart/form-data",
                },
            });

            toast.success(t("versionUpdated"));
            closeEditModal();

            try {
                await refreshVersion();
            } catch (err) {
                toast.error(t("errorOccurred"));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || t("errorOccurred"));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (versionId = editingVersionId) => {
        if(!versionId) {
            return;
        }

        if(!confirm(t("confirmDeleteVersion"))) {
            return;
        }

        setEditLoading(true);

        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/versions/${versionId}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            toast.success(t("versionDeleted"));
            router.push(`${getProjectPath(project)}/versions`);
        } catch (err) {
            toast.error(err.response?.data?.message || t("errorOccurred"));
        } finally {
            setEditLoading(false);
        }
    };

    const editGameVersionsLabel = editFormData.game_versions.length > 0 ? tSettings("versions.selectedGameVersions", { count: editFormData.game_versions.length }) : tSettings("versions.selectGameVersions");
    const editLoadersLabel = editFormData.loaders.length > 0 ? tSettings("versions.selectedLoaders", { count: editFormData.loaders.length }) : tSettings("versions.selectLoaders");

    return (
        <>
            <div className="project__general">
                <div>
                    <div className="version-page">
                        <div className="version-page__hero">
                            <div className="version-page__hero-row">
                                <div className="version-page__summary">
                                    <div className="version-page__heading">
                                        <h1>{versionDisplayName}</h1>

                                        {hasKnownReleaseChannel ? (
                                            <span className={`version-page__channel type--${releaseChannel}`}>
                                                {releaseChannelLabel}
                                            </span>
                                        ) : (
                                            <span className="version-page__channel">{releaseChannelLabel}</span>
                                        )}
                                    </div>

                                    <div className="version-page__subline">
                                        <span className="version-page__subline-item">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                                                <path d="m3.3 7 8.7 5 8.7-5"/>
                                                <path d="M12 22V12"/>
                                            </svg>

                                            {project.title || project.slug} {versionDisplayName}
                                        </span>
                                        
                                        <span aria-hidden="true">•</span>
                                        
                                        <Tooltip content={formatDate(currentVersion.created_at)} delay={300}>
                                            <span className="version-page__subline-item">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M8 2v4"/>
                                                    <path d="M16 2v4"/>
                                                    <rect width="18" height="18" x="3" y="4" rx="2"/>
                                                    <path d="M3 10h18"/>
                                                </svg>

                                                {formatRelativeTime(currentVersion.created_at)}
                                            </span>
                                        </Tooltip>
                                        
                                        <span aria-hidden="true">•</span>
                                        
                                        <span className="version-page__downloads">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M12 15V3"/>
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <path d="m7 10 5 5 5-5"/>
                                            </svg>

                                            {currentVersion.downloads || 0}
                                        </span>
                                    </div>
                                </div>

                                <div className="version-page__actions">
                                    {primaryFile && (
                                        <Tooltip content={primaryFileTooltip}>
                                            <VersionDownloadButton project={project} version={currentVersion} className="button button--size-m button--type-download button--with-icon" href={`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/versions/${currentVersion.id}/download`}>
                                                <svg className="masthead-stats__icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 15V3" />
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <path d="m7 10 5 5 5-5" />
                                                </svg>

                                                {t("download")}
                                            </VersionDownloadButton>
                                        </Tooltip>
                                    )}

                                    {shouldShowEditActions && (
                                        <div className="version-actions version-page__edit-actions">
                                            <button className="button button--size-m button--type-secondary button--with-icon version-page__edit-trigger" type="button" onClick={() => setOpenEditActionsVersionId((prev) => (prev === currentVersion.id ? null : currentVersion.id))} aria-label={t("editVersion")} title={t("editVersion")} aria-expanded={openEditActionsVersionId === currentVersion.id}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings">
                                                    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
                                                    <circle cx="12" cy="12" r="3"/>
                                                </svg>

                                                {t("editVersion")}

                                                <svg style={{ margin: "0 0 0 4px" }} className={`icon icon--chevron_down ${openEditActionsVersionId === currentVersion.id ? "rotate" : ""}`} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
                                                </svg>
                                            </button>

                                            {openEditActionsVersionId === currentVersion.id && (
                                                <div id="popover-overlay" className="popover-overlay version-actions__overlay version-page__actions-overlay">
                                                    <div className="popover" tabIndex={0} style={{ "--width": "max-content", "--top": "10px", "--position": "absolute", "--left": "auto", "--right": "0", "--bottom": "auto", "--distance": "8px" }}>
                                                        <div className="popover__scrollable" style={{ "--max-height": "auto" }}>
                                                            <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art" onClick={() => openEditModal(currentVersion.id, EDIT_MODAL_TYPES.METADATA)}>
                                                                <div className="context-list-option__art context-list-option__art--icon">
                                                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-box-icon lucide-box">
                                                                        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                                                                        <path d="m3.3 7 8.7 5 8.7-5"/>
                                                                        <path d="M12 22V12"/>
                                                                    </svg>
                                                                </div>

                                                                <div className="context-list-option__label">{tSettings("versions.modal.editMetadataTitle")}</div>
                                                            </button>

                                                            <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art" onClick={() => openEditModal(currentVersion.id, EDIT_MODAL_TYPES.DETAILS)}>
                                                                <div className="context-list-option__art context-list-option__art--icon">
                                                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info-icon lucide-info">
                                                                        <circle cx="12" cy="12" r="10"/>
                                                                        <path d="M12 16v-4"/>
                                                                        <path d="M12 8h.01"/>
                                                                    </svg>
                                                                </div>

                                                                <div className="context-list-option__label">{tSettings("versions.modal.editDetailsTitle")}</div>
                                                            </button>

                                                            <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art" onClick={() => openEditModal(currentVersion.id, EDIT_MODAL_TYPES.FILES)}>
                                                                <div className="context-list-option__art context-list-option__art--icon">
                                                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-digit-icon lucide-file-digit">
                                                                        <path d="M4 12V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2"/>
                                                                        <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                                                                        <path d="M10 16h2v6"/>
                                                                        <path d="M10 22h4"/>
                                                                        <rect x="2" y="16" width="4" height="6" rx="2"/>
                                                                    </svg>
                                                                </div>

                                                                <div className="context-list-option__label">{tSettings("versions.modal.editFilesTitle")}</div>
                                                            </button>

                                                            <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art color--negative" onClick={() => handleDelete(currentVersion.id)}>
                                                                <div className="context-list-option__art context-list-option__art--icon">
                                                                    <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash2-icon lucide-trash-2">
                                                                        <path d="M10 11v6"/>
                                                                        <path d="M14 11v6"/>
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                                                                        <path d="M3 6h18"/>
                                                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                                    </svg>
                                                                </div>

                                                                <div className="context-list-option__label">{t("delete")}</div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {requiredContent.length > 0 && (
                            <section className="version-page__required-content">
                                <h2>{t("versions.requiredContent")}</h2>

								<div className="version-page__required-grid">
									{requiredContent.map((item) => (
										<div key={item.id} className="version-page__required-card">
											{item.href ? (
												<Link href={item.href} className="version-page__required-link" aria-label={`${t("versions.downloadModal.viewProject")}: ${item.title}`}>
													<img src={item.icon} alt="" width="48" height="48" loading="lazy" className="version-page__required-icon" />

													<div className="version-page__required-copy">
														<strong>{item.title}</strong>
														<span>{t("versions.downloadModal.anyVersion")}</span>
													</div>
												</Link>
											) : (
												<div className="version-page__required-link">
													<img src={item.icon} alt="" width="48" height="48" loading="lazy" className="version-page__required-icon" />

													<div className="version-page__required-copy">
														<strong>{item.title}</strong>
														<span>{t("versions.downloadModal.anyVersion")}</span>
													</div>
												</div>
											)}

											<div className="version-page__required-actions">
                                                {item.href && (
                                                    <Tooltip content={t("versions.downloadModal.viewProject")} delay={300}>
                                                        <Link href={item.href} className="version-page__round-action button--active-transform" aria-label={t("versions.downloadModal.viewProject")}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                <path d="M15 3h6v6"/>
                                                                <path d="M10 14 21 3"/>
                                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                                            </svg>
                                                        </Link>
                                                    </Tooltip>
                                                )}

                                                {item.downloadHref && (
                                                    <Tooltip content={t("versions.downloadModal.downloadDependency")} delay={300}>
                                                        <a href={item.downloadHref} className="version-page__round-action version-page__round-action--download button--active-transform" aria-label={t("versions.downloadModal.downloadDependency")}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                <path d="M12 15V3"/>
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                                <path d="m7 10 5 5 5-5"/>
                                                            </svg>
                                                        </a>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="version-page__compatibility">
                            <h2>{t("versions.compatibility")}</h2>

                            <div className="version-page__compat-grid">
                                <div className="version-page__compat-card">
                                    <h3>{t("versions.metadata.hytaleVersions")}</h3>
                                    <div className="version-page__pills">
                                        {gameVersionList.length > 0 ? (
                                            <VersionDisplay gameVersions={gameVersionList} allGameVersions={gameVersionNames} />
                                        ) : (
                                            <span className="version-page__pill">{t("versions.notSpecified")}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="version-page__compat-card">
                                    <h3>{t("versions.metadata.platform")}</h3>
                                    <div className="version-page__pills">
                                        {loaderList.length > 0 ? loaderList.map((loader) => (
                                            <span key={loader} className="version__game-platform">
                                                {loader.trim()}
                                            </span>
                                        )) : <span className="version-page__pill">{t("versions.notSpecified")}</span>}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="version-page__changelog">
                            <h2>{t("changesTitle")}</h2>

                            <div className="version-page__changelog-card markdown-body">
                                {hasChangelog ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({ href, children }) => {
                                                const safeHref = getSafeMarkdownHref(href);
                                                if(!safeHref) {
                                                    return <>{children}</>;
                                                }

                                                const isExternal = /^https?:\/\//i.test(safeHref);
                                                return (
                                                    <a href={safeHref} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>
                                                        {children}
                                                    </a>
                                                );
                                            },
                                        }}
                                    >
                                        {currentVersion.changelog}
                                    </ReactMarkdown>
                                ) : (
                                    <p>{t("noChanges")}</p>
                                )}
                            </div>
                        </section>

                        {optionalContent.length > 0 && (
                            <section className="version-page__required-content">
                                <h2>{t("versions.optionalDependencies")}</h2>

								<div className="version-page__required-grid">
									{optionalContent.map((item) => (
										<div key={item.id} className="version-page__required-card">
											{item.href ? (
												<Link href={item.href} className="version-page__required-link" aria-label={`${t("versions.downloadModal.viewProject")}: ${item.title}`}>
													<img src={item.icon} alt="" width="48" height="48" loading="lazy" className="version-page__required-icon" />

													<div className="version-page__required-copy">
														<strong>{item.title}</strong>
														<span>{t("versions.downloadModal.anyVersion")}</span>
													</div>
												</Link>
											) : (
												<div className="version-page__required-link">
													<img src={item.icon} alt="" width="48" height="48" loading="lazy" className="version-page__required-icon" />

													<div className="version-page__required-copy">
														<strong>{item.title}</strong>
														<span>{t("versions.downloadModal.anyVersion")}</span>
													</div>
												</div>
											)}

											<div className="version-page__required-actions">
                                                {item.href && (
                                                    <Tooltip content={t("versions.downloadModal.viewProject")} delay={300}>
                                                        <Link href={item.href} className="version-page__round-action button--active-transform" aria-label={t("versions.downloadModal.viewProject")}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                <path d="M15 3h6v6"/>
                                                                <path d="M10 14 21 3"/>
                                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                                            </svg>
                                                        </Link>
                                                    </Tooltip>
                                                )}

                                                {item.downloadHref && (
                                                    <Tooltip content={t("versions.downloadModal.downloadDependency")} delay={300}>
                                                        <a href={item.downloadHref} className="version-page__round-action version-page__round-action--download button--active-transform" aria-label={t("versions.downloadModal.downloadDependency")}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                <path d="M12 15V3"/>
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                                <path d="m7 10 5 5 5-5"/>
                                                            </svg>
                                                        </a>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                <ProjectSidebar project={project} />
            </div>

            <VersionEditMetadataModal
                isOpen={editModalType === EDIT_MODAL_TYPES.METADATA}
                onRequestClose={closeEditModal}
                editLoading={editLoading}
                onSubmit={handleUpdate}
                t={tSettings}
                tProject={t}
                editFormData={editFormData}
                handleEditInputChange={handleEditInputChange}
                releaseChannels={releaseChannels}
                handleSelectEditReleaseChannel={handleSelectEditReleaseChannel}
                editGameVersionsRef={editGameVersionsRef}
                toggleEditGameVersionsPopover={() => setIsEditGameVersionsPopoverOpen((prev) => !prev)}
                isEditGameVersionsPopoverOpen={isEditGameVersionsPopoverOpen}
                gameVersions={gameVersionItems}
                handleEditToggleGameVersion={handleEditToggleGameVersion}
                editGameVersionsLabel={editGameVersionsLabel}
                editLoadersRef={editLoadersRef}
                toggleEditLoadersPopover={() => setIsEditLoadersPopoverOpen((prev) => !prev)}
                isEditLoadersPopoverOpen={isEditLoadersPopoverOpen}
                loaders={loaders}
                handleEditToggleLoader={handleEditToggleLoader}
                editLoadersLabel={editLoadersLabel}
            />

            <VersionEditDetailsModal
                isOpen={editModalType === EDIT_MODAL_TYPES.DETAILS}
                onRequestClose={closeEditModal}
                editLoading={editLoading}
                onSubmit={handleUpdate}
                t={tSettings}
                tProject={t}
                editFormData={editFormData}
                handleEditInputChange={handleEditInputChange}
                releaseChannels={releaseChannels}
                handleSelectEditReleaseChannel={handleSelectEditReleaseChannel}
                dependencyTypes={dependencyTypes}
                editDependencyDraft={editDependencyDraft}
                handleEditDependencyDraftChange={handleEditDependencyDraftChange}
                handleAddEditDependency={handleAddEditDependency}
                handleRemoveEditDependency={handleRemoveEditDependency}
            />

            <VersionEditFilesModal
                isOpen={editModalType === EDIT_MODAL_TYPES.FILES}
                onRequestClose={closeEditModal}
                editLoading={editLoading}
                onSubmit={handleUpdate}
                t={tSettings}
                tProject={t}
                versionFileAccept={VERSION_FILE_ACCEPT}
                maxFileSize={MAX_VERSION_FILE_SIZE}
                fileTooLargeMessage={tSettings("versions.errors.fileTooLarge")}
                currentFileName={getFileNameFromUrl(editVersionFile.url)}
                formatFileSize={formatFileSize}
            />
        </>
    );
}