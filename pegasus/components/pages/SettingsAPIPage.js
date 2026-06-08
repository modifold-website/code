"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslations } from "next-intl";
import CreateApiTokenModal from "../../modal/CreateApiTokenModal";

export default function SettingsAPIPage({ initialUser = null, initialTokens = null, authToken = null }) {
    const t = useTranslations("SettingsAPIPage");
    const { isLoggedIn, user } = useAuth();
    const router = useRouter();
    const effectiveUser = user || initialUser;

    const [tokens, setTokens] = useState(initialTokens || []);
    const [newToken, setNewToken] = useState(null);
    const [form, setForm] = useState({
        name: "",
        duration: "1m",
    });
    const [isTokensLoading, setIsTokensLoading] = useState(initialTokens === null);
    const [isCreatingToken, setIsCreatingToken] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        if(!isLoggedIn && !initialUser) {
            router.push("/403");
            return;
        }

        if(initialTokens === null) {
            loadTokens();
        }
    }, [isLoggedIn, router, initialTokens, initialUser]);

    const loadTokens = async () => {
        try {
            setIsTokensLoading(true);
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/api-tokens`, {
                headers: { Authorization: `Bearer ${authToken || localStorage.getItem("authToken")}` },
            });

            setTokens(res.data.tokens || []);
        } catch (err) {
            toast.error(t("errors.loadTokens"));
        } finally {
            setIsTokensLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectDuration = (val) => {
        setForm((prev) => ({ ...prev, duration: val }));
        setIsDurationPopoverOpen(false);
    };

    const handleCreateToken = async (e) => {
        e.preventDefault();
        if(!form.name.trim()) {
            toast.error(t("errors.tokenNameRequired"));
            return;
        }

        try {
            setIsCreatingToken(true);
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE}/api-tokens`, form, {
                headers: { Authorization: `Bearer ${authToken || localStorage.getItem("authToken")}` },
            });

            setNewToken(res.data);
            toast.success(t("success.created"));
            setIsCreateModalOpen(false);
            setForm({ name: "", duration: "1m" });
            await loadTokens();
        } catch (err) {
            toast.error(err.response?.data?.message || t("errors.createToken"));
        } finally {
            setIsCreatingToken(false);
        }
    };

    const handleCopyToken = () => {
        if(newToken?.token) {
            navigator.clipboard.writeText(newToken.token);
            toast.success(t("success.copied"));
        }
    };

    const handleRevokeToken = async (tokenId) => {
        if(!confirm(t("confirmRevoke"))) {
            return;
        }

        try {
            await axios.delete(`${process.env.NEXT_PUBLIC_API_BASE}/api-tokens/${tokenId}`, {
                headers: { Authorization: `Bearer ${authToken || localStorage.getItem("authToken")}` },
            });

            toast.success(t("success.revoked"));
            loadTokens();
        } catch (err) {
            toast.error(t("errors.revokeToken"));
        }
    };

    if(!isLoggedIn && !effectiveUser) {
        return null;
    }

    return (
        <>
            <div>
                <div className="settings-wrapper blog-settings">
                    <div className="blog-settings__body">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                            <p className="blog-settings__field-title" style={{ marginBottom: "0" }}>{t("title")}</p>
                            
                            <button type="button" className="button button--size-m button--type-primary button--active-transform" onClick={() => setIsCreateModalOpen(true)}>
                                {t("createToken")}
                            </button>
                        </div>

                        <p>{t("description")}</p>

                        {newToken && (
                            <div className="new-token-alert">
                                <h3>{t("newTokenTitle")}</h3>
                                <div className="token-display">
                                    <code>{newToken.token}</code>

                                    <button onClick={handleCopyToken} className="button button--size-s button--type-primary">
                                        {t("copy")}
                                    </button>
                                </div>

                                <p style={{ marginBottom: "8px" }}>
                                    <strong>{t("importantLabel")}</strong> {t("importantBody")}
                                </p>

                                <p>
                                    {t("expiresLabel")} {newToken.expires_at ? new Date(newToken.expires_at).toLocaleString() : t("never")}
                                </p>
                            </div>
                        )}

                        <div className="api-docs-link">
                            <p>
                                {t("docsPrompt")} {" "}
                                <a href={`${process.env.NEXT_PUBLIC_API_BASE}/api-docs`} target="_blank">
                                    {t("docsLink")}
                                </a>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="tokens-list">
                    <p className="blog-settings__field-title">{t("tokensTitle")}</p>

                    {isTokensLoading ? (
                        <p>{t("loadingTokens")}</p>
                    ) : tokens.length === 0 ? (
                        <p>{t("noTokens")}</p>
                    ) : (
                        <table className="tokens-table">
                            <thead>
                                <tr>
                                    <th>{t("table.name")}</th>
                                    <th>{t("table.token")}</th>
                                    <th>{t("table.created")}</th>
                                    <th>{t("table.expires")}</th>
                                    <th></th>
                                </tr>
                            </thead>

                            <tbody>
                                {tokens.map((token) => (
                                    <tr key={token.id}>
                                        <td>{token.name}</td>
                                        <td>
                                            <code>{token.token}</code>
                                        </td>
                                        <td>{new Date(token.created_at).toLocaleDateString()}</td>
                                        <td>
                                            {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : t("never")}
                                        </td>
                                        <td>
                                            <button onClick={() => handleRevokeToken(token.id)} className="button button--size-s button--type-danger">
                                                {t("revoke")}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <CreateApiTokenModal isOpen={isCreateModalOpen} onRequestClose={() => setIsCreateModalOpen(false)} form={form} onInputChange={handleInputChange} onSelectDuration={handleSelectDuration} onSubmit={handleCreateToken} isCreatingToken={isCreatingToken} />
        </>
    );
}