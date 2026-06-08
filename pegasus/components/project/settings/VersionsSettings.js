"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { getProjectPath } from "@/utils/projectRoutes";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslations } from "next-intl";
import axios from "axios";
import VersionDisplay from "../../VersionDisplay";
import VersionUploadModal from "../../../modal/VersionUploadModal";
import VersionEditMetadataModal from "../../../modal/VersionEditMetadataModal";
import VersionEditDetailsModal from "../../../modal/VersionEditDetailsModal";
import VersionEditFilesModal from "../../../modal/VersionEditFilesModal";
import { DEFAULT_GAME_VERSIONS, normalizeGameVersionItemsPayload, sortByKnownGameVersions } from "@/utils/gameVersions";

const loaders = [
    "Vanilla",
];

const releaseChannels = ["release", "beta", "alpha"];
const dependencyTypes = ["required", "optional", "incompatible", "embedded"];
const VERSION_FILE_ACCEPT = ".jar,.zip,.rar,application/zip, application/x-rar-compressed, application/vnd.rar, application/java-archive";
const MAX_VERSION_FILE_SIZE = 100 * 1024 * 1024;
const VERSION_UPLOAD_STEPS = {
    FILES: "files",
    METADATA: "metadata",
    COMPATIBILITY: "compatibility",
};
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
const VERSION_MODERATION_BADGE_TYPES = {
    approved: "success",
    pending: "pending",
    scanning: "pending",
    needs_review: "pending",
    blocked: "blocked",
    error: "error",
};
const VERSION_MODERATION_STATUS_KEYS = new Set(Object.keys(VERSION_MODERATION_BADGE_TYPES));

export default function VersionsSettings({ project, authToken, gameVersions = DEFAULT_GAME_VERSIONS }) {
    const t = useTranslations("SettingsProjectPage");
    const tProject = useTranslations("ProjectPage");

    const [showUpload, setShowUpload] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploadDragActive, setIsUploadDragActive] = useState(false);
    const [uploadStep, setUploadStep] = useState(VERSION_UPLOAD_STEPS.FILES);

    const [formData, setFormData] = useState({
        version_number: "",
        changelog: "",
        release_channel: "release",
        game_versions: [],
        loaders: [],
        dependencies: [],
    });
    const [uploadDependencyDraft, setUploadDependencyDraft] = useState(createEmptyDependencyDraft);

    const [isGameVersionsPopoverOpen, setIsGameVersionsPopoverOpen] = useState(false);
    const [isLoadersPopoverOpen, setIsLoadersPopoverOpen] = useState(false);
    const gameVersionsRef = useRef(null);
    const loadersRef = useRef(null);
    const uploadFileRef = useRef(null);

    const [isEditGameVersionsPopoverOpen, setIsEditGameVersionsPopoverOpen] = useState(false);
    const [isEditLoadersPopoverOpen, setIsEditLoadersPopoverOpen] = useState(false);
    const editGameVersionsRef = useRef(null);
    const editLoadersRef = useRef(null);

    const [isFilterGameVersionsPopoverOpen, setIsFilterGameVersionsPopoverOpen] = useState(false);
    const [isFilterChannelsPopoverOpen, setIsFilterChannelsPopoverOpen] = useState(false);
    const [isFilterLoadersPopoverOpen, setIsFilterLoadersPopoverOpen] = useState(false);
    const [filterGameVersions, setFilterGameVersions] = useState([]);
    const [filterChannels, setFilterChannels] = useState([]);
    const [filterLoaders, setFilterLoaders] = useState([]);

    const filterGameVersionsRef = useRef(null);
    const filterChannelsRef = useRef(null);
    const filterLoadersRef = useRef(null);

    const [editModalType, setEditModalType] = useState(null);
    const [openEditActionsVersionId, setOpenEditActionsVersionId] = useState(null);
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
    const gameVersionItems = useMemo(() => normalizeGameVersionItemsPayload({ game_versions: gameVersions }), [gameVersions]);
    const gameVersionNames = useMemo(() => gameVersionItems.map((item) => item.version), [gameVersionItems]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(gameVersionsRef.current && !gameVersionsRef.current.contains(event.target)) {
                setIsGameVersionsPopoverOpen(false);
            }

            if(loadersRef.current && !loadersRef.current.contains(event.target)) {
                setIsLoadersPopoverOpen(false);
            }

            if(editGameVersionsRef.current && !editGameVersionsRef.current.contains(event.target)) {
                setIsEditGameVersionsPopoverOpen(false);
            }

            if(editLoadersRef.current && !editLoadersRef.current.contains(event.target)) {
                setIsEditLoadersPopoverOpen(false);
            }

            if(filterGameVersionsRef.current && !filterGameVersionsRef.current.contains(event.target)) {
                setIsFilterGameVersionsPopoverOpen(false);
            }

            if(filterChannelsRef.current && !filterChannelsRef.current.contains(event.target)) {
                setIsFilterChannelsPopoverOpen(false);
            }

            if(filterLoadersRef.current && !filterLoadersRef.current.contains(event.target)) {
                setIsFilterLoadersPopoverOpen(false);
            }

            if(!event.target.closest(".version-actions")) {
                setOpenEditActionsVersionId(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleGameVersionsPopover = () => {
        setIsGameVersionsPopoverOpen((prev) => !prev);
    };

    const toggleLoadersPopover = () => {
        setIsLoadersPopoverOpen((prev) => !prev);
    };

    const toggleEditGameVersionsPopover = () => {
        setIsEditGameVersionsPopoverOpen((prev) => !prev);
    };

    const toggleEditLoadersPopover = () => {
        setIsEditLoadersPopoverOpen((prev) => !prev);
    };

    const toggleFilterGameVersionsPopover = () => {
        setIsFilterGameVersionsPopoverOpen((prev) => !prev);
    };

    const toggleFilterChannelsPopover = () => {
        setIsFilterChannelsPopoverOpen((prev) => !prev);
    };

    const toggleFilterLoadersPopover = () => {
        setIsFilterLoadersPopoverOpen((prev) => !prev);
    };

    const handleToggleFilterGameVersion = (version) => {
        setFilterGameVersions((prev) => (prev.includes(version) ? prev.filter((v) => v !== version) : [...prev, version]));
    };

    const handleToggleFilterChannel = (channel) => {
        setFilterChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
    };

    const handleToggleFilterLoader = (loader) => {
        const normalized = String(loader || "").toLowerCase();
        setFilterLoaders((prev) => (prev.includes(normalized) ? prev.filter((l) => l !== normalized) : [...prev, normalized]));
    };

    const handleToggleGameVersion = (version) => {
        setFormData((prev) => ({
            ...prev,
            game_versions: prev.game_versions.includes(version) ? prev.game_versions.filter((v) => v !== version) : [...prev.game_versions, version],
        }));
    };

    const handleToggleLoader = (loader) => {
        setFormData((prev) => ({
            ...prev,
            loaders: prev.loaders.includes(loader) ? prev.loaders.filter((l) => l !== loader) : [...prev.loaders, loader],
        }));
    };

    const handleSelectReleaseChannel = (channel) => {
        setFormData((prev) => ({ ...prev, release_channel: channel }));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if(!uploadFile) {
            toast.error(t("versions.errors.upload"));
            return;
        }

        if(formData.game_versions.length === 0 || formData.loaders.length === 0) {
            toast.error(t("versions.errors.selectVersionsAndLoaders"));
            return;
        }

        setUploadLoading(true);

        const formDataToSend = new FormData();
        formDataToSend.append("file", uploadFile);
        formDataToSend.append("version_number", formData.version_number);
        formDataToSend.append("changelog", formData.changelog);
        formDataToSend.append("release_channel", formData.release_channel);
        formDataToSend.append("game_versions", JSON.stringify(formData.game_versions));
        formDataToSend.append("loaders", JSON.stringify(formData.loaders));
        formDataToSend.append("dependencies", JSON.stringify((formData.dependencies || []).map((dependency) => ({
            slug: dependency.project_slug || "",
            version_id: dependency.version_id || "",
            type: dependency.dependency_type || "required",
        }))));

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/versions`, {
                method: "POST",
                headers: { Authorization: `Bearer ${authToken}` },
                body: formDataToSend,
            });

            if(response.ok) {
                toast.success(t("versions.successModeration"));
                setShowUpload(false);
                resetUploadForm();

                try {
                    await refreshVersions();
                } catch (err) {
                    toast.error(tProject("errorOccurred"));
                }
            } else {
                toast.error(t("versions.errors.upload"));
            }
        } finally {
            setUploadLoading(false);
        }
    };

    const parseVersionList = (value) => {
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
        const dependencyType = String(dependency.dependency_type || "required").trim().toLowerCase();
        if(!projectId && !versionId) {
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
        };
    };

    const parseDependencies = (value) => {
        if(!Array.isArray(value)) {
            return [];
        }

        return value.map((item) => normalizeDependency(item)).filter(Boolean);
    };

    const getDependencyKey = (dependency) => {
        const projectId = String(dependency?.project_id || "").trim().toLowerCase();
        const versionId = String(dependency?.version_id || "").trim().toLowerCase();

        return `${projectId}::${versionId || "__project_only__"}`;
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

    const handleUploadDependencyDraftChange = updateDependencyDraft(setUploadDependencyDraft);

    const handleAddUploadDependency = () => {
        addDependencyToForm({
            draft: uploadDependencyDraft,
            formSetter: setFormData,
            draftSetter: setUploadDependencyDraft,
            duplicateMessage: "This dependency is already in the list.",
        });
    };

    const handleRemoveUploadDependency = (indexToRemove) => {
        setFormData((prev) => ({
            ...prev,
            dependencies: (prev.dependencies || []).filter((_, index) => index !== indexToRemove),
        }));
    };

    const openEditModal = async (versionId, modalType) => {
        const selectedVersion = versions.find((version) => version.id === versionId);
        const initialGameVersions = parseVersionList(selectedVersion?.game_versions);
        const initialLoaders = parseVersionList(selectedVersion?.loaders);
        const initialDependencies = parseDependencies(selectedVersion?.dependencies);

        setOpenEditActionsVersionId(null);
        setEditingVersionId(versionId);
        setEditLoading(true);
        setEditVersionFile({
            url: selectedVersion?.file_url || "",
            size: Number.isFinite(selectedVersion?.file_size) ? selectedVersion.file_size : Number(selectedVersion?.file_size),
        });
        setEditFormData({
            version_number: selectedVersion?.version_number || "",
            changelog: selectedVersion?.changelog || "",
            release_channel: selectedVersion?.release_channel || "release",
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
            const nextGameVersions = parseVersionList(version.game_versions);
            const nextLoaders = parseVersionList(version.loaders);
            const nextDependencies = parseDependencies(version.dependencies);
            setEditFormData({
                version_number: version.version_number || "",
                changelog: version.changelog || "",
                release_channel: version.release_channel || "release",
                game_versions: nextGameVersions,
                loaders: nextLoaders,
                dependencies: nextDependencies,
            });
            setEditVersionFile({
                url: version.file_url || "",
                size: Number.isFinite(version.file_size) ? version.file_size : Number(version.file_size),
            });
        } catch (err) {
            toast.error(err.response?.data?.message || tProject("errorOccurred"));
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

    const cancelUpload = () => {
        if(uploadLoading) {
            return;
        }

        setShowUpload(false);
        resetUploadForm();
    };

    const goToUploadCompatibilityStep = () => {
        if(uploadLoading) {
            return;
        }

        setUploadStep(VERSION_UPLOAD_STEPS.COMPATIBILITY);
    };

    const goToUploadFilesStep = () => {
        if(uploadLoading) {
            return;
        }

        setUploadStep(VERSION_UPLOAD_STEPS.FILES);
    };

    const goToUploadMetadataStepBack = () => {
        if(uploadLoading) {
            return;
        }

        setUploadStep(VERSION_UPLOAD_STEPS.METADATA);
    };

    const openUploadModal = () => {
        resetUploadForm();
        setShowUpload(true);
    };

    const handleUploadFileChange = (event) => {
        const nextFile = event.target.files?.[0] || null;
        if(nextFile && nextFile.size > MAX_VERSION_FILE_SIZE) {
            toast.error(t("versions.errors.fileTooLarge"));
            if(uploadFileRef.current) {
                uploadFileRef.current.value = "";
            }
            setUploadFile(null);
            return;
        }

        setUploadFile(nextFile);

        if(nextFile) {
            setUploadStep(VERSION_UPLOAD_STEPS.METADATA);
        }
    };

    const handleUploadDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsUploadDragActive(false);

        const nextFile = event.dataTransfer?.files?.[0] || null;
        if(nextFile) {
            if(nextFile.size > MAX_VERSION_FILE_SIZE) {
                toast.error(t("versions.errors.fileTooLarge"));
                return;
            }

            setUploadFile(nextFile);
            setUploadStep(VERSION_UPLOAD_STEPS.METADATA);
        }
    };

    const handleUploadDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if(!isUploadDragActive) {
            setIsUploadDragActive(true);
        }
    };

    const handleUploadDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if(event.currentTarget.contains(event.relatedTarget)) {
            return;
        }

        setIsUploadDragActive(false);
    };

    const openUploadFilePicker = () => {
        if(uploadLoading) {
            return;
        }

        if(uploadFileRef.current) {
            uploadFileRef.current.value = "";
            uploadFileRef.current.click();
        }
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

    const handleEditToggleGameVersion = (version) => {
        setEditFormData((prev) => ({
            ...prev,
            game_versions: prev.game_versions.includes(version) ? prev.game_versions.filter((v) => v !== version) : [...prev.game_versions, version],
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
            toast.error(tProject("fillRequiredFields"));
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

            toast.success(tProject("versionUpdated"));
            closeEditModal();

            try {
                await refreshVersions();
            } catch (err) {
                toast.error(tProject("errorOccurred"));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || tProject("errorOccurred"));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (versionId = editingVersionId) => {
        if(!versionId) {
            return;
        }

        if(!confirm(tProject("confirmDeleteVersion"))) {
            return;
        }

        setEditLoading(true);

        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}/versions/${versionId}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            toast.success(tProject("versionDeleted"));

            if(editModalType) {
                closeEditModal();
            } else {
                setOpenEditActionsVersionId(null);
                if(editingVersionId === versionId) {
                    setEditingVersionId(null);
                }
            }

            try {
                await refreshVersions();
            } catch (err) {
                toast.error(tProject("errorOccurred"));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || tProject("errorOccurred"));
        } finally {
            setEditLoading(false);
        }
    };

    const gameVersionsLabel = formData.game_versions.length > 0 ? t("versions.selectedGameVersions", { count: formData.game_versions.length }) : t("versions.selectGameVersions");
    const loadersLabel = formData.loaders.length > 0 ? t("versions.selectedLoaders", { count: formData.loaders.length }) : t("versions.selectLoaders");
    const editGameVersionsLabel = editFormData.game_versions.length > 0 ? t("versions.selectedGameVersions", { count: editFormData.game_versions.length }) : t("versions.selectGameVersions");
    const editLoadersLabel = editFormData.loaders.length > 0 ? t("versions.selectedLoaders", { count: editFormData.loaders.length }) : t("versions.selectLoaders");
    const [versions, setVersions] = useState(project?.versions || []);

    useEffect(() => {
        setVersions(project?.versions || []);
    }, [project?.versions]);

    const refreshVersions = async () => {
        const resProject = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/projects/${project.slug}`, {
            headers: {
                Accept: "application/json",
                Authorization: authToken ? `Bearer ${authToken}` : undefined,
            },
        });

        if(!resProject.ok) {
            throw new Error("Failed to refresh project versions");
        }

        const nextProject = await resProject.json();
        setVersions(nextProject?.versions || []);
    };

    const getVersionModerationBadge = (status) => {
        const statusKey = String(status || "approved");
        const normalizedStatus = VERSION_MODERATION_STATUS_KEYS.has(statusKey) ? statusKey : "approved";
        return {
            type: VERSION_MODERATION_BADGE_TYPES[normalizedStatus] || "pending",
            label: tProject(`versions.statuses.${normalizedStatus}`),
        };
    };

    const resetUploadForm = () => {
        setFormData({
            version_number: "",
            changelog: "",
            release_channel: "release",
            game_versions: [],
            loaders: [],
            dependencies: [],
        });

        setIsGameVersionsPopoverOpen(false);
        setIsLoadersPopoverOpen(false);
        setIsUploadDragActive(false);
        setUploadFile(null);
        setUploadDependencyDraft(createEmptyDependencyDraft());
        setUploadStep(VERSION_UPLOAD_STEPS.FILES);
        if(uploadFileRef.current) {
            uploadFileRef.current.value = "";
        }
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

    const availableGameVersions = useMemo(() => {
        const items = versions.flatMap((version) => {
            if(!version?.game_versions) {
                return [];
            }

            if(Array.isArray(version.game_versions)) {
                return version.game_versions.map((v) => String(v).trim()).filter(Boolean);
            }

            return String(version.game_versions).split(",").map((v) => v.trim()).filter(Boolean);
        });

        return sortByKnownGameVersions([...new Set(items)], gameVersionNames);
    }, [versions, gameVersionNames]);

    const availableChannels = useMemo(() => {
        const items = versions.map((v) => v?.release_channel).filter(Boolean);
        return [...new Set(items)].filter((channel) => releaseChannels.includes(channel));
    }, [versions]);

    const availableLoaders = useMemo(() => {
        const items = versions.flatMap((version) => {
            if(!version?.loaders) {
                return [];
            }

            const raw = String(version.loaders);
            if(!raw.trim() || raw === "null") {
                return [];
            }

            return raw.toLowerCase().split(",").map((l) => l.trim()).filter(Boolean);
        });

        return [...new Set(items)].sort();
    }, [versions]);

    const filteredVersions = useMemo(() => {
        return versions.filter((version) => {
            const gameVersionsMatch = filterGameVersions.length === 0 || (version?.game_versions && filterGameVersions.some((filterVersion) => {
                const list = Array.isArray(version.game_versions) ? version.game_versions.map((v) => String(v).trim()) : String(version.game_versions).split(",").map((v) => v.trim());

                return list.includes(filterVersion);
            }));

            const channelMatch = filterChannels.length === 0 || filterChannels.includes(version?.release_channel);

            const loadersMatch = filterLoaders.length === 0 || (version?.loaders && filterLoaders.some((filterLoader) => String(version.loaders).toLowerCase().split(",").map((l) => l.trim()).includes(filterLoader)));

            return gameVersionsMatch && channelMatch && loadersMatch;
        });
    }, [versions, filterGameVersions, filterChannels, filterLoaders]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
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

    return (
        <>
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                    <div className="version-filters" style={{ display: "flex", gap: "8px" }}>
                        <div className="field field--default" ref={filterGameVersionsRef}>
                            <button style={{ display: "flex", gap: "4px" }} type="button" className="button button--size-m button--type-secondary" onClick={toggleFilterGameVersionsPopover} aria-label={tProject("filters.gameVersionsAria")}>
                                {tProject("tabs.gameVersion")}

                                <svg className="icon icon--chevron_down" width="20" height="20" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
                                </svg>
                            </button>

                            {isFilterGameVersionsPopoverOpen && (
                                <div className="popover">
                                    <div className="context-list" style={{ maxHeight: "200px" }}>
                                        {availableGameVersions.map((version) => (
                                            <div key={version} className={`context-list-option ${filterGameVersions.includes(version) ? "context-list-option--selected" : ""}`} onClick={() => handleToggleFilterGameVersion(version)}>
                                                <div className="context-list-option__label">{version}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="field field--default" ref={filterChannelsRef}>
                            <button style={{ display: "flex", gap: "4px" }} type="button" className="button button--size-m button--type-secondary" onClick={toggleFilterChannelsPopover} aria-label={tProject("filters.channelsAria")}>
                                {tProject("tabs.gameChannel")}

                                <svg className="icon icon--chevron_down" width="20" height="20" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
                                </svg>
                            </button>

                            {isFilterChannelsPopoverOpen && (
                                <div className="popover">
                                    <div className="context-list" style={{ maxHeight: "200px" }}>
                                        {availableChannels.map((channel) => (
                                            <div key={channel} className={`context-list-option ${filterChannels.includes(channel) ? "context-list-option--selected" : ""}`} onClick={() => handleToggleFilterChannel(channel)}>
                                                <div className="context-list-option__label">{channel.charAt(0).toUpperCase() + channel.slice(1)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="field field--default" ref={filterLoadersRef}>
                            <button style={{ display: "flex", gap: "4px" }} type="button" className="button button--size-m button--type-secondary" onClick={toggleFilterLoadersPopover} aria-label={tProject("filters.loadersAria")}>
                                {tProject("tabs.loader") || "Loader"}

                                <svg className="icon icon--chevron_down" width="20" height="20" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
                                </svg>
                            </button>

                            {isFilterLoadersPopoverOpen && (
                                <div className="popover">
                                    <div className="context-list" style={{ maxHeight: "200px" }}>
                                        {availableLoaders.map((loader) => (
                                            <div key={loader} className={`context-list-option ${filterLoaders.includes(loader) ? "context-list-option--selected" : ""}`} onClick={() => handleToggleFilterLoader(loader)}>
                                                <div className="context-list-option__label">{loader.charAt(0).toUpperCase() + loader.slice(1)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button type="button" className="button button--size-m button--type-primary" onClick={openUploadModal}>
                        {t("versions.title")}
                    </button>
                </div>

                <div className="all-versions">
                    <div className="card-header">
                        <div></div>
                        <div>{tProject("versions.headers.version")}</div>
                        <div>{tProject("versions.headers.statistics")}</div>
                    </div>

                    {filteredVersions.length === 0 ? (
                        <div className="subsite-empty-feed">
                            <p className="subsite-empty-feed__title">{tProject("noFiles")}</p>
                        </div>
                    ) : (
                        filteredVersions.map((version) => {
                            const moderationBadge = getVersionModerationBadge(version.moderation_status);

                            return (
                            <div key={version.id} className="version-button">
                                <div className="version-actions">
                                    <button className="download-button version-actions__trigger" type="button" onClick={() => setOpenEditActionsVersionId((prev) => (prev === version.id ? null : version.id))} aria-label={tProject("editVersion")} title={tProject("editVersion")} aria-expanded={openEditActionsVersionId === version.id}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings">
                                            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    </button>

                                    {openEditActionsVersionId === version.id && (
                                        <div id="popover-overlay" className="popover-overlay version-actions__overlay">
                                            <div className="popover" tabIndex={0} style={{ "--width": "max-content", "--top": "46px", "--position": "absolute", "--left": "0", "--right": "auto", "--bottom": "auto", "--distance": "8px" }}>
                                                <div className="popover__scrollable" style={{ "--max-height": "auto" }}>
                                                    <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art" onClick={() => openEditModal(version.id, EDIT_MODAL_TYPES.METADATA)}>
                                                        <div className="context-list-option__art context-list-option__art--icon">
                                                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-box-icon lucide-box">
                                                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                                                                <path d="m3.3 7 8.7 5 8.7-5"/>
                                                                <path d="M12 22V12"/>
                                                            </svg>
                                                        </div>
                                                        
                                                        <div className="context-list-option__label">{t("versions.modal.editMetadataTitle")}</div>
                                                    </button>

                                                    <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art" onClick={() => openEditModal(version.id, EDIT_MODAL_TYPES.DETAILS)}>
                                                        <div className="context-list-option__art context-list-option__art--icon">
                                                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info-icon lucide-info">
                                                                <circle cx="12" cy="12" r="10"/>
                                                                <path d="M12 16v-4"/>
                                                                <path d="M12 8h.01"/>
                                                            </svg>
                                                        </div>
                                                        
                                                        <div className="context-list-option__label">{t("versions.modal.editDetailsTitle")}</div>
                                                    </button>

                                                    <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art" onClick={() => openEditModal(version.id, EDIT_MODAL_TYPES.FILES)}>
                                                        <div className="context-list-option__art context-list-option__art--icon">
                                                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-digit-icon lucide-file-digit">
                                                                <path d="M4 12V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2"/>
                                                                <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                                                                <path d="M10 16h2v6"/>
                                                                <path d="M10 22h4"/>
                                                                <rect x="2" y="16" width="4" height="6" rx="2"/>
                                                            </svg>
                                                        </div>
                                                        
                                                        <div className="context-list-option__label">{t("versions.modal.editFilesTitle")}</div>
                                                    </button>

                                                    <button style={{ width: "100%" }} type="button" className="context-list-option context-list-option--with-art color--negative" onClick={() => handleDelete(version.id)}>
                                                        <div className="context-list-option__art context-list-option__art--icon">
                                                            <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash2-icon lucide-trash-2">
                                                                <path d="M10 11v6"/>
                                                                <path d="M14 11v6"/>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                                                                <path d="M3 6h18"/>
                                                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                            </svg>
                                                        </div>

                                                        <div className="context-list-option__label">{tProject("delete")}</div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Link href={`${getProjectPath(project)}/version/${version.id}`}>
                                    <span className="version__title">
                                        {version.version_number}

                                        {version.loaders && version.loaders.trim() && version.loaders !== "null" ? (
                                            version.loaders.split(",").map((loader, index) => (
                                                <span key={index} className="version__game-platform">
                                                    {loader.trim()}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="version__game-platform">{tProject("versions.notSpecified")}</span>
                                        )}

                                        <VersionDisplay gameVersions={version.game_versions ? version.game_versions.split(",").map((v) => v.trim()).filter(Boolean) : []} allGameVersions={gameVersionNames} />
                                    </span>

                                    <div className="version__metadata">
                                        <span className={`version__badge type--${moderationBadge.type}`} style={{ marginRight: "8px" }}>
                                            <span className="circle"></span>
                                            {moderationBadge.label}
                                        </span>

                                        <span className="version_number">{formatDate(version.created_at)}</span>
                                    </div>
                                </Link>

                                <div className="version__stats">
                                    <strong>{version.downloads}</strong>
                                    <span>{tProject("versions.downloads")}</span>
                                </div>
                            </div>
                            );
                        })
                    )}
                </div>
            </div>

            <VersionUploadModal
                isOpen={showUpload}
                onRequestClose={cancelUpload}
                uploadLoading={uploadLoading}
                uploadStep={uploadStep}
                uploadSteps={VERSION_UPLOAD_STEPS}
                uploadFile={uploadFile}
                isUploadDragActive={isUploadDragActive}
                uploadFileRef={uploadFileRef}
                versionFileAccept={VERSION_FILE_ACCEPT}
                openUploadFilePicker={openUploadFilePicker}
                handleUploadDragOver={handleUploadDragOver}
                handleUploadDragLeave={handleUploadDragLeave}
                handleUploadDrop={handleUploadDrop}
                handleUploadFileChange={handleUploadFileChange}
                formatFileSize={formatFileSize}
                goToUploadCompatibilityStep={goToUploadCompatibilityStep}
                goToUploadFilesStep={goToUploadFilesStep}
                goToUploadMetadataStepBack={goToUploadMetadataStepBack}
                handleSubmit={handleSubmit}
                formData={formData}
                handleInputChange={handleInputChange}
                releaseChannels={releaseChannels}
                handleSelectReleaseChannel={handleSelectReleaseChannel}
                gameVersionsRef={gameVersionsRef}
                toggleGameVersionsPopover={toggleGameVersionsPopover}
                isGameVersionsPopoverOpen={isGameVersionsPopoverOpen}
                gameVersions={gameVersionItems}
                handleToggleGameVersion={handleToggleGameVersion}
                gameVersionsLabel={gameVersionsLabel}
                loadersRef={loadersRef}
                toggleLoadersPopover={toggleLoadersPopover}
                isLoadersPopoverOpen={isLoadersPopoverOpen}
                loaders={loaders}
                handleToggleLoader={handleToggleLoader}
                loadersLabel={loadersLabel}
                dependencyTypes={dependencyTypes}
                uploadDependencyDraft={uploadDependencyDraft}
                handleUploadDependencyDraftChange={handleUploadDependencyDraftChange}
                handleAddUploadDependency={handleAddUploadDependency}
                handleRemoveUploadDependency={handleRemoveUploadDependency}
                t={t}
                tProject={tProject}
            />

            <VersionEditMetadataModal
                isOpen={editModalType === EDIT_MODAL_TYPES.METADATA}
                onRequestClose={closeEditModal}
                editLoading={editLoading}
                onSubmit={handleUpdate}
                t={t}
                tProject={tProject}
                editFormData={editFormData}
                handleEditInputChange={handleEditInputChange}
                releaseChannels={releaseChannels}
                handleSelectEditReleaseChannel={handleSelectEditReleaseChannel}
                editGameVersionsRef={editGameVersionsRef}
                toggleEditGameVersionsPopover={toggleEditGameVersionsPopover}
                isEditGameVersionsPopoverOpen={isEditGameVersionsPopoverOpen}
                gameVersions={gameVersionItems}
                handleEditToggleGameVersion={handleEditToggleGameVersion}
                editGameVersionsLabel={editGameVersionsLabel}
                editLoadersRef={editLoadersRef}
                toggleEditLoadersPopover={toggleEditLoadersPopover}
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
                t={t}
                tProject={tProject}
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
                t={t}
                tProject={tProject}
                versionFileAccept={VERSION_FILE_ACCEPT}
                maxFileSize={MAX_VERSION_FILE_SIZE}
                fileTooLargeMessage={t("versions.errors.fileTooLarge")}
                currentFileName={getFileNameFromUrl(editVersionFile.url)}
                formatFileSize={formatFileSize}
            />
        </>
    );
}