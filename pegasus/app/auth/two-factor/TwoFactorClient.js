"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/AuthProvider";

function parseHashParams() {
    if(typeof window === "undefined") {
        return new URLSearchParams();
    }

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    return new URLSearchParams(hash);
}

function getSafeNextPath(nextPath) {
    if(!nextPath || typeof nextPath !== "string") {
        return "/";
    }

    if(!nextPath.startsWith("/") || nextPath.startsWith("//")) {
        return "/";
    }

    return nextPath;
}

export default function TwoFactorClient() {
    const t = useTranslations("TwoFactorLogin");
    const { completeLogin } = useAuth();
    const [token, setToken] = useState("");
    const [code, setCode] = useState("");
    const [nextPath, setNextPath] = useState("/");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const params = parseHashParams();
        const twoFactorToken = params.get("token");
        const next = getSafeNextPath(params.get("next"));

        if(!twoFactorToken) {
            setErrorMessage(t("errors.missingToken"));
            return;
        }

        setToken(twoFactorToken);
        setNextPath(next);
    }, [t]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setErrorMessage("");

        if(!code.trim()) {
            setErrorMessage(t("errors.missingCode"));
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/2fa/verify-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, code: code.trim() }),
            });

            if(!response.ok) {
                const data = await response.json().catch(() => ({}));
                setErrorMessage(data?.message || t("errors.invalidCode"));
                setIsSubmitting(false);
                return;
            }

            const data = await response.json();
            if(!data?.token) {
                setErrorMessage(t("errors.invalidResponse"));
                setIsSubmitting(false);
                return;
            }

            await completeLogin(data.token);
            window.location.replace(nextPath);
        } catch (error) {
            setErrorMessage(t("errors.generic"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "32px 16px" }}>
            <div style={{ maxWidth: "460px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h1 style={{ fontSize: "24px", fontWeight: "500", marginBottom: "8px" }}>{t("title")}</h1>
                <p style={{ marginBottom: "16px", color: "var(--theme-color-text-secondary)", textAlign: "center" }}>{t("description")}</p>

                <form onSubmit={handleSubmit} className="content content--padding" style={{ borderRadius: "16px", width: "100%" }}>
                    <label style={{ display: "block", marginBottom: "12px" }}>{t("codeLabel")}</label>

                    <div className="field field--default">
                        <label className="field__wrapper" style={{ marginBottom: "12px" }}>
                            <input value={code} inputMode="numeric" placeholder={t("codePlaceholder")} onChange={(event) => setCode(event.target.value)} className="text-input" type="text" />
                        </label>
                    </div>

                    {errorMessage && (
                        <div style={{ color: "#e11d48", marginBottom: "12px" }}>{errorMessage}</div>
                    )}

                    <button type="submit" className="button button--size-m button--type-primary" disabled={isSubmitting || !token}>
                        {isSubmitting ? t("submitting") : t("submit")}
                    </button>
                </form>
            </div>
        </div>
    );
}