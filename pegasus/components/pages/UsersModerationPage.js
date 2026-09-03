"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Modal from "react-modal";
import Image from "next/image";
import { useTranslations } from "next-intl";
import UserName from "../ui/UserName";

Modal.setAppElement("body");

export default function UsersModerationPage({ authToken, initialUsers, initialTotalPages }) {
    const t = useTranslations("UsersModerationPage");
    const [users, setUsers] = useState(initialUsers || []);
    const [totalPages, setTotalPages] = useState(initialTotalPages || 1);
    const [page, setPage] = useState(1);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRolePopoverOpen, setIsRolePopoverOpen] = useState(null);
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        isRole: "",
        slug: "",
        description: "",
        avatar: null,
    });
    const [previewAvatar, setPreviewAvatar] = useState("");
    const avatarInputRef = useRef(null);
    const rolePopoverRef = useRef(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const params = { page, limit: 15 };
                const response = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/moderation/users`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                    params,
                });

                setUsers(response.data.users);
                setTotalPages(response.data.totalPages);
            } catch (err) {
                toast.error(t("errors.fetch"));
            }
        };

        fetchUsers();
    }, [authToken, page, t]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(rolePopoverRef.current && !rolePopoverRef.current.contains(event.target)) {
                setIsRolePopoverOpen(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const openEditModal = (user) => {
        setSelectedUser(user);
        setFormData({
            username: user.username || "",
            email: user.email || "",
            isRole: user.isRole || "user",
            slug: user.slug || "",
            description: user.description || "",
            avatar: null,
        });
        setPreviewAvatar(user.avatar || "");
        setIsModalOpen(true);
        setIsRolePopoverOpen(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if(file && file.size > 20 * 1024 * 1024) {
            toast.error(t("errors.fileTooLarge"));
            return;
        }

        setFormData((prev) => ({ ...prev, avatar: file }));
        setPreviewAvatar(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if(!selectedUser) {
            return;
        }

        const data = new FormData();
        if(formData.username) {
            data.append("username", formData.username);
        }

        if(formData.email) {
            data.append("email", formData.email);
        }

        if(formData.slug) {
            data.append("slug", formData.slug);
        }

        if(formData.description) {
            data.append("description", formData.description);
        }

        if(formData.avatar) {
            data.append("avatar", formData.avatar);
        }

        if(formData.isRole) {
            data.append("isRole", formData.isRole);
        }

        try {
            const res = await axios.put(`${process.env.NEXT_PUBLIC_API_BASE}/moderation/users/${selectedUser.id}`, data, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            setUsers(users.map((u) => (u.id === selectedUser.id ? res.data : u)));
            toast.success(t("success.userUpdated"));
            setIsModalOpen(false);
        } catch (err) {
            toast.error(err.response?.data?.message || t("errors.updateUser"));
        }
    };

    const handleAvatarOverlayClick = () => {
        avatarInputRef.current?.click();
    };

    return (
        <>
            <div className="content content--padding" style={{ marginBottom: "15px" }}>
                {users.length === 0 ? (
                    <p>{t("empty")}</p>
                ) : (
                    <div className="users-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {users.map((user) => (
                            <div key={user.id} className="user-card" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "var(--theme-color-background)", borderRadius: "8px" }}>
                                <Image src={user.avatar || "/images/user/default_ava.png"} alt={user.username} width={40} height={40} style={{ borderRadius: "8px" }} />

                                <UserName user={user} />

                                <div style={{ marginLeft: "auto", position: "relative" }} ref={isRolePopoverOpen === user.id ? rolePopoverRef : null}>
                                    <button className="icon-button" onClick={() => setIsRolePopoverOpen(isRolePopoverOpen === user.id ? null : user.id)} aria-label={t("actions.editAria")}>
                                        <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>

                                    {isRolePopoverOpen === user.id && (
                                        <div className="popover" style={{ position: "absolute", width: "max-content", top: "100%", left: "-105px", zIndex: 1000 }}>
                                            <div className="context-list" style={{ maxHeight: "200px", overflowY: "auto" }}>
                                                <div className="context-list-option" onClick={() => openEditModal(user)} style={{ cursor: "pointer" }}>
                                                    <div className="context-list-option__label">{t("actions.edit")}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="pagination" style={{ marginTop: "20px", alignItems: "center" }}>
                        <button className="button button--size-m button--type-minimal" disabled={page === 1} onClick={() => setPage(page - 1)}>
                            {t("pagination.previous")}
                        </button>

                        <span style={{ margin: "0 10px" }}>
                            {t("pagination.pageOf", { page, totalPages })}
                        </span>

                        <button className="button button--size-m button--type-minimal" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                            {t("pagination.next")}
                        </button>
                    </div>
                )}
            </div>

            <Modal closeTimeoutMS={150} isOpen={isModalOpen} onRequestClose={() => setIsModalOpen(false)} className="modal active" overlayClassName="modal-overlay">
                <div className="modal-window" style={{ maxHeight: "min(900px, 100dvh - 32px)" }}>
                    <div className="modal-window__header">
                        <span style={{ fontSize: "18px", fontWeight: "500" }}>{t("modal.title", { username: selectedUser?.username })}</span>
                        
                        <button className="icon-button modal-window__close" type="button" onClick={() => setIsModalOpen(false)} aria-label={t("actions.close")}>
                            <svg className="icon icon--cross" height="24" width="24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                            </svg>
                        </button>
                    </div>

                    <div className="modal-window__content">
                        <form onSubmit={handleSubmit}>
                            <p className="blog-settings__field-title">{t("fields.avatar")}</p>
                            <div className="subsite-avatar subsite-header__avatar" style={{ marginTop: "0" }}>
                                <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--has-preview subsite-avatar__image andropov-image andropov-image--zoom" style={{ aspectRatio: "1 / 1", width: "90px", height: "90px", maxWidth: "none", "--background-color": "#30382d" }} data-loaded="true">
                                    {previewAvatar && <img id="create_image_url_avatar" src={previewAvatar} alt={t("fields.avatarAlt")} />}
                                </div>

                                <div className="subsite-avatar__overlay" onClick={handleAvatarOverlayClick}>
                                    <svg className="icon icon--image" width="40" height="40" viewBox="0 0 24 24">
                                        <path d="M8 9.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"></path>
                                        <path fillRule="evenodd" clipRule="evenodd" d="M7 3a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7ZM5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5.252l-1.478-1.477a2 2 0 0 0-3.014.214L8.5 19H7a2 2 0 0 1-2-2V7Zm11.108 5.19L19 15.08V17a2 2 0 0 1-2 2h-6l5.108-6.81Z"></path>
                                    </svg>
                                </div>
                            </div>

                            <input type="file" accept="image/*" onChange={handleFileChange} ref={avatarInputRef} style={{ display: "none" }} />

                            <p className="blog-settings__field-title">{t("fields.username")}</p>
                            <div className="field field--default blog-settings__input">
                                <label className="field__wrapper">
                                    <input type="text" name="username" value={formData.username} onChange={handleInputChange} placeholder={t("placeholders.username")} className="text-input" maxLength="30" />
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("fields.email")}</p>
                            <div className="field field--default blog-settings__input">
                                <label className="field__wrapper">
                                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder={t("placeholders.email")} className="text-input" />
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("fields.slug")}</p>
                            <div className="field field--default blog-settings__input">
                                <label className="field__wrapper">
                                    <input type="text" name="slug" value={formData.slug} onChange={handleInputChange} placeholder={t("placeholders.slug")} className="text-input" />
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("fields.description")}</p>
                            <div className="field field--default textarea blog-settings__input">
                                <label className="field__wrapper">
                                    <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder={t("placeholders.description")} className="autosize textarea__input" style={{ height: "128px" }} />
                                </label>
                            </div>

                            <p className="blog-settings__field-title">{t("fields.role")}</p>
                            <div className="field field--default blog-settings__input">
                                <label className="field__wrapper">
                                    <select name="isRole" value={formData.isRole} onChange={handleInputChange} className="text-input">
                                        <option value="admin">{t("roles.admin")}</option>
                                        <option value="moderator">{t("roles.moderator")}</option>
                                        <option value="user">{t("roles.user")}</option>
                                    </select>
                                </label>
                            </div>

                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "18px" }}>
                                <button type="button" className="button button--size-m button--type-minimal" onClick={() => setIsModalOpen(false)}>
                                    {t("actions.cancel")}
                                </button>

                                <button type="submit" className="button button--size-m button--type-primary">
                                    {t("actions.save")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Modal>
        </>
    );
}