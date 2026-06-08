"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import DeleteAccountSection from "../DeleteAccountSection";
import TwoFactorSetupModal from "@/modal/TwoFactorSetupModal";
import TwoFactorDisableModal from "@/modal/TwoFactorDisableModal";
import ChangePasswordModal from "@/modal/ChangePasswordModal";

export default function SettingsAccountSecurityPage({ initialUser = null, initialTwoFactor = null, initialPassword = null, authToken = null }) {
    const t = useTranslations("SettingsBlogPage");
    const { isLoggedIn, user } = useAuth();
    const router = useRouter();
    const effectiveUser = user || initialUser;
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(initialTwoFactor?.enabled));
    const [passwordEnabled, setPasswordEnabled] = useState(Boolean(initialPassword?.enabled));
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [isSetupOpen, setIsSetupOpen] = useState(false);
    const [isDisableOpen, setIsDisableOpen] = useState(false);
    const token = authToken || (typeof window !== "undefined" ? localStorage.getItem("authToken") : null);

    useEffect(() => {
        if(!isLoggedIn && !initialUser) {
            router.push("/403");
        }
    }, [initialUser, isLoggedIn, router]);

    if(!isLoggedIn && !effectiveUser) {
        return null;
    }

    const handleRefreshStatus = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/2fa/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json().catch(() => ({}));
            if(res.ok) {
                setTwoFactorEnabled(Boolean(data?.enabled));
            }
        } catch {}
    };

    const handleRefreshPasswordStatus = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/password/status`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            const data = await res.json().catch(() => ({}));
            if(res.ok) {
                setPasswordEnabled(Boolean(data?.enabled));
            }
        } catch {}
    };

    useEffect(() => {
        if(initialTwoFactor === null) {
            handleRefreshStatus();
        }
    }, [initialTwoFactor]);

    useEffect(() => {
        if(initialPassword === null) {
            handleRefreshPasswordStatus();
        }
    }, [initialPassword]);

    return (
        <>
            <div className="settings-wrapper--narrow">
                <div className="settings-wrapper blog-settings">
                    <div className="blog-settings__body">
                        <p className="blog-settings__field-title">{t("accountSecurity.title")}</p>
                        <p style={{ marginBottom: "14px", color: "var(--theme-color-text-secondary)" }}>{t("accountSecurity.description")}</p>

                        {passwordEnabled && (
                            <form className="settings-twofactor-card">
                                <div>
                                    <div className="settings-twofactor-title">{t("passwordChange.title")}</div>
                                    
                                    <div className="settings-twofactor-description">{t("passwordChange.description")}</div>
                                </div>

                                <button type="button" className="button button--size-m button--with-icon button--type-minimal" onClick={() => setIsPasswordOpen(true)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-key-round-icon lucide-key-round">
                                        <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/>
                                        <circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>
                                    </svg>
                                    
                                    {t("passwordChange.submit")}
                                </button>
                            </form>
                        )}

                        <div className="settings-twofactor-card">
                            <div>
                                <div className="settings-twofactor-title">{t("twoFactor.title")}</div>
                                
                                <div className="settings-twofactor-description">{t("twoFactor.description")}</div>
                            </div>

                            {twoFactorEnabled ? (
                                <button type="button" className="button button--size-m button--with-icon button--type-minimal" onClick={() => setIsDisableOpen(true)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-minus-icon lucide-shield-minus">
                                        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                                        <path d="M9 12h6"/>
                                    </svg>
                                    
                                    {t("twoFactor.disable")}
                                </button>
                            ) : (
                                <button type="button" className="button button--size-m button--with-icon button--type-minimal" onClick={() => setIsSetupOpen(true)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus-icon lucide-plus">
                                        <path d="M5 12h14"/>
                                        <path d="M12 5v14"/>
                                    </svg>
                                    
                                    {t("twoFactor.enable")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                <DeleteAccountSection />
            </div>

            <TwoFactorSetupModal
                isOpen={isSetupOpen}
                authToken={token}
                onRequestClose={() => setIsSetupOpen(false)}
                onEnabled={() => {
                    setIsSetupOpen(false);
                    setTwoFactorEnabled(true);
                }}
            />

            <TwoFactorDisableModal
                isOpen={isDisableOpen}
                authToken={token}
                onRequestClose={() => setIsDisableOpen(false)}
                onDisabled={() => {
                    setIsDisableOpen(false);
                    handleRefreshStatus();
                }}
            />

            <ChangePasswordModal
                isOpen={isPasswordOpen}
                authToken={token}
                onRequestClose={() => setIsPasswordOpen(false)}
            />
        </>
    );
}