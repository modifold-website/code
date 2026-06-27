"use client";

import React, { useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useAuth } from "../components/providers/AuthProvider";
import { getLastSignInProvider, setLastSignInProvider, setPendingSignInProvider } from "../utils/authSignInProvider";

if(typeof window !== "undefined") {
    Modal.setAppElement("body");
}

function getReturnPath() {
    if(typeof window === "undefined") {
        return "/";
    }

    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return path.startsWith("/") ? path : "/";
}

function redirectTo(url, onClose) {
    onClose();
    window.location.assign(url);
}

function EmailAuthField({ children }) {
    return (
        <div className="field field--large">
            <label className="field__wrapper">
                {children}
            </label>
        </div>
    );
}

function PasswordField({ autoComplete, name, placeholder, value, onChange, showPassword, onToggle, t }) {
    return (
        <EmailAuthField>
            <input className="text-input" name={name} type={showPassword ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} minLength={8} value={value} onChange={onChange} required />
            
            <button className="email-auth__password-toggle" type="button" onClick={onToggle} aria-label={showPassword ? t("hidePassword") : t("showPassword")}>
                {showPassword ? (
                    <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                        <path d="m2 2 20 20" />
                    </svg>
                ) : (
                    <svg className="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </button>
        </EmailAuthField>
    );
}

function EmailLoginAuth({ isOpen, onBack, onClose }) {
    const t = useTranslations("LoginModal.emailAuth");
    const { completeLogin } = useAuth();
    const [mode, setMode] = useState("login");
    const [form, setForm] = useState({ email: "", password: "", username: "", code: "" });
    const [captchaToken, setCaptchaToken] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isModeTransitioning, setIsModeTransitioning] = useState(false);
    const captchaRef = useRef(null);
    const captchaWidgetRef = useRef(null);
    const transitionTimeoutRef = useRef(null);
    const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((currentForm) => ({ ...currentForm, [name]: value }));
    };

    const resetCaptcha = () => {
        setCaptchaToken("");
        if(typeof window !== "undefined" && window.hcaptcha && captchaWidgetRef.current !== null) {
            window.hcaptcha.reset(captchaWidgetRef.current);
        }
    };

    const switchMode = (nextMode, afterSwitch) => {
        if(nextMode === mode || isModeTransitioning) {
            return;
        }

        window.clearTimeout(transitionTimeoutRef.current);
        setIsModeTransitioning(true);
        transitionTimeoutRef.current = window.setTimeout(() => {
            setMode(nextMode);
            afterSwitch?.();
            requestAnimationFrame(() => {
                setIsModeTransitioning(false);
            });
        }, 150);
    };

    const openRegister = () => {
        setStatusMessage("");
        resetCaptcha();
        switchMode("register");
    };

    const openLogin = () => {
        setStatusMessage("");
        resetCaptcha();
        switchMode("login");
    };

    const handleClose = () => {
        window.clearTimeout(transitionTimeoutRef.current);
        setMode("login");
        setStatusMessage("");
        setIsSubmitting(false);
        setShowPassword(false);
        setIsModeTransitioning(false);
        resetCaptcha();
        onClose();
    };

    const handleBack = () => {
        window.clearTimeout(transitionTimeoutRef.current);
        setMode("login");
        setStatusMessage("");
        setIsSubmitting(false);
        setShowPassword(false);
        setIsModeTransitioning(false);
        resetCaptcha();
        onBack();
    };

    const submitLogin = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setStatusMessage("");

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/email-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email, password: form.password }),
            });
            const data = await response.json();

            if(!response.ok || !data.success) {
                throw new Error(t("errors.invalidCredentials"));
            }

            if(data.twoFactorRequired && data.twoFactorToken) {
                setPendingSignInProvider("email");
                const nextPath = getReturnPath();
                const hash = new URLSearchParams({ token: data.twoFactorToken, next: nextPath }).toString();
                window.location.assign(`/auth/two-factor#${hash}`);
                return;
            }

            await completeLogin(data.token);
            setLastSignInProvider("email");
            handleClose();
        } catch (error) {
            toast.error(error.message || t("errors.login"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitRegister = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setStatusMessage("");

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/email-register/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: form.username,
                    email: form.email,
                    password: form.password,
                    hcaptchaToken: captchaToken,
                }),
            });
            const data = await response.json();

            if(!response.ok || !data.success) {
                throw new Error(data.message || t("errors.register"));
            }

            switchMode("verify", () => setStatusMessage(t("codeSent")));
        } catch (error) {
            toast.error(error.message || t("errors.register"));
            resetCaptcha();
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitVerification = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setStatusMessage("");

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/email-register/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email, code: form.code }),
            });
            const data = await response.json();

            if(!response.ok || !data.success) {
                throw new Error(data.message || t("errors.verify"));
            }

            await completeLogin(data.token);
            setLastSignInProvider("email");
            handleClose();
        } catch (error) {
            toast.error(error.message || t("errors.verify"));
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if(!isOpen || mode !== "register" || !captchaSiteKey || !captchaRef.current || typeof window === "undefined") {
            return;
        }

        const renderCaptcha = () => {
            if(!window.hcaptcha || captchaWidgetRef.current !== null || !captchaRef.current) {
                return;
            }

            captchaWidgetRef.current = window.hcaptcha.render(captchaRef.current, {
                sitekey: captchaSiteKey,
                callback: setCaptchaToken,
                "expired-callback": () => setCaptchaToken(""),
                "error-callback": () => setCaptchaToken(""),
            });
        };

        if(window.hcaptcha) {
            renderCaptcha();
            return;
        }

        const existingScript = document.querySelector("script[data-hcaptcha-script]");
        if(existingScript) {
            existingScript.addEventListener("load", renderCaptcha, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.hcaptchaScript = "true";
        script.addEventListener("load", renderCaptcha, { once: true });
        document.body.appendChild(script);
    }, [captchaSiteKey, isOpen, mode]);

    useEffect(() => {
        if(mode !== "register") {
            captchaWidgetRef.current = null;
        }
    }, [mode]);

    useEffect(() => {
        return () => {
            window.clearTimeout(transitionTimeoutRef.current);
        };
    }, []);

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={handleClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <button className="icon-button modal-window__back" type="button" onClick={handleBack} aria-label={t("back")} style={{ marginLeft: "-14px", marginRight: "16px" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fill: "none" }}>
                            <path d="m15 18-6-6 6-6"></path>
                        </svg>
                    </button>

                    <button className="icon-button modal-window__close" type="button" onClick={handleClose} aria-label={t("close")}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                        </svg>
                    </button>
                </div>

                <div className="modal-window__content">
                    <div className={`auth email-auth ${isModeTransitioning ? "email-auth--transitioning" : ""}`}>
                        <h2 className="email-auth__title">{mode === "login" ? t("loginTitle") : mode === "register" ? t("registerTitle") : t("verifyTitle")}</h2>

                        {mode === "login" && (
                            <form className="email-auth__form" onSubmit={submitLogin}>
                                <EmailAuthField>
                                    <input className="text-input" name="email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} value={form.email} onChange={updateField} required />
                                </EmailAuthField>

                                <PasswordField autoComplete="current-password" name="password" placeholder={t("passwordPlaceholder")} value={form.password} onChange={updateField} showPassword={showPassword} onToggle={() => setShowPassword((current) => !current)} t={t} />

                                {statusMessage && <p className="email-auth__status">{statusMessage}</p>}
                                
                                <button className="button button--size-xl button--type-primary button--active-transform" type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? t("submitting") : t("loginButton")}
                                </button>
                            </form>
                        )}

                        {mode === "register" && (
                            <form className="email-auth__form" onSubmit={submitRegister}>
                                <EmailAuthField>
                                    <input className="text-input" name="username" type="text" autoComplete="username" placeholder={t("usernamePlaceholder")} minLength={2} maxLength={100} value={form.username} onChange={updateField} required />
                                </EmailAuthField>

                                <EmailAuthField>
                                    <input className="text-input" name="email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} value={form.email} onChange={updateField} required />
                                </EmailAuthField>

                                <PasswordField autoComplete="new-password" name="password" placeholder={t("passwordPlaceholder")} value={form.password} onChange={updateField} showPassword={showPassword} onToggle={() => setShowPassword((current) => !current)} t={t} />

                                <div className="email-auth__captcha">
                                    {captchaSiteKey ? <div ref={captchaRef}></div> : <p className="email-auth__status">{t("captchaMissing")}</p>}
                                </div>

                                {statusMessage && <p className="email-auth__status">{statusMessage}</p>}
                                
                                <button className="button button--size-xl button--type-primary button--active-transform" type="submit" disabled={isSubmitting || !captchaToken}>
                                    {isSubmitting ? t("submitting") : t("registerButton")}
                                </button>
                            </form>
                        )}

                        {mode === "verify" && (
                            <form className="email-auth__form" onSubmit={submitVerification}>
                                <p className="email-auth__description">{t("verifyDescription", { email: form.email })}</p>
                                <EmailAuthField>
                                    <input className="text-input" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder={t("codePlaceholder")} maxLength={6} value={form.code} onChange={updateField} required />
                                </EmailAuthField>
                                
                                {statusMessage && <p className="email-auth__status">{statusMessage}</p>}
                                
                                <button className="button button--size-xl button--type-primary button--active-transform" type="submit" disabled={isSubmitting || form.code.trim().length === 0}>
                                    {isSubmitting ? t("submitting") : t("verifyButton")}
                                </button>
                            </form>
                        )}

                        <div className="auth__footer">
                            {mode === "login" ? (
                                <button className="link-button link-button--default" type="button" onClick={openRegister}>
                                    {t("createAccount")}
                                </button>
                            ) : (
                                <button className="link-button link-button--default" type="button" onClick={openLogin}>
                                    {t("backToLogin")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default function LoginModal({ isOpen, onClose }) {
    const t = useTranslations("LoginModal");
    const [isDataModalOpen, setIsDataModalOpen] = useState(false);
    const [isEmailAuthOpen, setIsEmailAuthOpen] = useState(false);
    const [lastSignInProvider, setLastSignInProviderState] = useState("");

    const handleTelegramClick = () => {
        const botName = "8388910351";
        const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_API_BASE}/auth/telegram-callback`);
        callbackUrl.searchParams.set("next", getReturnPath());
        sessionStorage.setItem("telegramAuthReturnPath", getReturnPath());
        setPendingSignInProvider("telegram");

        const url = `https://oauth.telegram.org/auth?bot_id=${botName}&origin=${encodeURIComponent(window.location.origin)}&return_to=${encodeURIComponent(callbackUrl.toString())}`;
        redirectTo(url, onClose);
    };

    const handleGitHubClick = () => {
        const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
        const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_API_BASE}/auth/github-callback`);
        const scope = "user:email";
        const state = encodeURIComponent(getReturnPath());
        const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
        setPendingSignInProvider("github");

        redirectTo(url, onClose);
    };

    const handleDiscordClick = () => {
        const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
        const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_API_BASE}/auth/discord-callback`);
        const scope = encodeURIComponent("identify email");
        const state = encodeURIComponent(getReturnPath());
        const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
        setPendingSignInProvider("discord");

        redirectTo(url, onClose);
    };

    const openDataModal = () => {
        setIsDataModalOpen(true);
    };

    const closeDataModal = () => {
        setIsDataModalOpen(false);
    };

    const openEmailAuth = () => {
        setIsEmailAuthOpen(true);
    };

    const closeEmailAuth = () => {
        setIsEmailAuthOpen(false);
        onClose();
    };

    useEffect(() => {
        if(!isOpen) {
            setIsEmailAuthOpen(false);
            setIsDataModalOpen(false);
            return;
        }

        setLastSignInProviderState(getLastSignInProvider());
    }, [isOpen]);

    const renderLastSignInBadge = (provider) => {
        if(lastSignInProvider !== provider) {
            return null;
        }

        return (
            <span className="oauth-provider-last-sign-in-badge">
                {t("lastSignIn")}
            </span>
        );
    };

    return (
        <>
            <Modal closeTimeoutMS={150} isOpen={isOpen && !isEmailAuthOpen && !isDataModalOpen} onRequestClose={onClose} className="modal active" overlayClassName="modal-overlay">
                <div className="modal-window">
                    <div className="modal-window__header">
                        <button className="icon-button modal-window__close" type="button" onClick={onClose} aria-label={t("close")}>
                            <svg className="icon icon--cross" height="24" width="24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                            </svg>
                        </button>
                    </div>

                    <div className="modal-window__content">
                        <div className="auth will-be-animated">
                            <div className="logreg__logo-container logreg__logo-container--padding">
                                <svg width="86" height="85" viewBox="0 0 86 85" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "48px", height: "100%" }}>
                                    <path d="M0 36.788C0 6.49309 6.50029 0 36.8288 0H48.2655C78.594 0 85.0943 6.49309 85.0943 36.788V48.212C85.0943 78.5068 78.594 85 48.2655 85H36.8288C6.50029 85 0 78.5068 0 48.212V36.788Z" fill="url(#paint0_linear_6642_2)"></path>
                                    <path d="M42.1389 9.28913C42.5195 9.06622 42.9903 9.06622 43.3709 9.28913L71.6206 25.83C71.9958 26.0497 72.2266 26.4527 72.2266 26.8885V58.2922C72.2266 58.73 71.9937 59.1351 71.6156 59.354L43.3659 75.7139C42.9878 75.9328 42.522 75.9328 42.1439 75.7139L13.8943 59.354C13.5162 59.1351 13.2832 58.73 13.2832 58.2922V26.8885C13.2832 26.4527 13.514 26.0497 13.8892 25.83L42.1389 9.28913ZM16.5399 28.0235V57.161L42.7549 72.3901L68.9702 57.161V28.0235L42.7549 12.606L16.5399 28.0235ZM65.9578 29.5322V55.7467L42.7549 68.9955L19.5522 55.7467V29.5322L42.7549 16.0007L65.9578 29.5322ZM22.6372 54.191L41.5329 65.0349V43.6295L22.6372 32.8798V54.191ZM44.2592 43.661V64.9408L63.0609 54.1603V32.7855L44.2592 43.661ZM39.5587 57.7743V61.1851L36.7384 59.5659V56.1713L39.5587 57.7743ZM48.9593 59.5659L46.1392 61.1851V57.7743L48.9593 56.1713V59.5659ZM27.5256 50.9851V54.3797L24.6114 52.7767V49.3821L27.5256 50.9851ZM61.0867 52.7767L58.1723 54.3797V50.9851L61.0867 49.3821V52.7767ZM34.4822 46.0816V52.3994L29.2178 49.4762V43.1584L34.4822 46.0816ZM56.48 49.4762L51.2158 52.3994V46.0816L56.48 43.1584V49.4762ZM39.6527 45.2329V48.8161L36.7384 47.2131V43.6299L39.6527 45.2329ZM48.9593 47.2131L46.0454 48.8161V45.2329L48.9593 43.6299V47.2131ZM27.5256 38.6322V42.0269L24.6114 40.4238V37.0291L27.5256 38.6322ZM61.0867 40.4237L58.1723 42.0269V38.632L61.0867 37.029V40.4237Z" fill="white"></path>
                                    <defs>
                                        <linearGradient id="paint0_linear_6642_2" x1="-1.0674e-06" y1="4.00018e-06" x2="84.9999" y2="85.0943" gradientUnits="userSpaceOnUse">
                                            <stop stop-color="#68A5FF"></stop>
                                            <stop offset="0.5" stop-color="#307DF0"></stop>
                                            <stop offset="1" stop-color="#307DF0"></stop>
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>

                            <div className="auth__content auth__content--stretched" style={{ gap: "10px" }}>
                                <button style={{ display: "none" }} className="button button--size-xl button--type-minimal button--with-icon button--active-transform oauth-provider-button" type="button">
                                    <svg className="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M13.7023 0.0130647V7.89884L10.3939 7.8908L10.3284 0L4 0.934093L6.017 4.71971L6.01898 17.2619L10.3761 20.4696L10.3786 11.685L13.6428 11.6985V24L17.9775 20.8063V4.72373L20 0.944142L13.7023 0.0130647Z" fill="black"/>
                                    </svg>

                                    Continue with Hytale
                                </button>
                                
                                <button className="button button--size-xl button--type-minimal button--with-icon button--active-transform oauth-provider-button" type="button" onClick={handleGitHubClick}>
                                    <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <g clip-path="url(#clip0_11566_2)">
                                            <path d="M12 0C5.373 0 0 5.373 0 12C0 17.302 3.438 21.8 8.207 23.387C8.807 23.498 9 23.126 9 22.81V20.576C5.662 21.302 4.967 19.16 4.967 19.16C4.421 17.773 3.634 17.403 3.634 17.403C2.544 16.658 3.717 16.674 3.717 16.674C4.922 16.758 5.555 17.911 5.555 17.911C6.625 19.745 8.362 19.215 9.047 18.908C9.155 18.133 9.465 17.603 9.809 17.303C7.144 16.998 4.342 15.969 4.342 11.371C4.342 10.06 4.811 8.99 5.578 8.15C5.454 7.847 5.043 6.626 5.695 4.974C5.695 4.974 6.703 4.652 8.996 6.204C9.97528 5.9385 10.9854 5.80367 12 5.803C13.02 5.808 14.047 5.941 15.006 6.207C17.297 4.655 18.303 4.977 18.303 4.977C18.956 6.63 18.545 7.851 18.421 8.153C19.191 8.993 19.656 10.063 19.656 11.374C19.656 15.983 16.849 16.998 14.177 17.295C14.607 17.667 15 18.397 15 19.517V22.81C15 23.129 15.192 23.504 15.801 23.386C20.566 21.797 24 17.3 24 12C24 5.373 18.627 0 12 0Z" fill="currentColor"/>
                                        </g>
                                        <defs>
                                            <clipPath id="clip0_11566_2">
                                                <rect width="24" height="24" fill="white"/>
                                            </clipPath>
                                        </defs>
                                    </svg>

                                    {t("continueWith", { provider: "GitHub" })}
                                    
                                    {renderLastSignInBadge("github")}
                                </button>

                                <button className="button button--size-xl button--type-minimal button--with-icon button--active-transform oauth-provider-button" type="button" onClick={handleDiscordClick}>
                                    <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <g clip-path="url(#clip0_11566_5)">
                                            <path d="M20.3175 4.36988C18.7615 3.65581 17.1195 3.14656 15.4325 2.85488C15.4171 2.85188 15.4011 2.85385 15.3869 2.8605C15.3728 2.86715 15.361 2.87814 15.3535 2.89188C15.1435 3.26688 14.9095 3.75588 14.7455 4.14188C12.9269 3.86612 11.0771 3.86612 9.25848 4.14188C9.07532 3.71448 8.86935 3.29721 8.64148 2.89188C8.63331 2.87873 8.62149 2.86823 8.60747 2.86166C8.59344 2.8551 8.57782 2.85274 8.56248 2.85488C6.87523 3.14546 5.23306 3.65475 3.67748 4.36988C3.66503 4.37652 3.65412 4.38572 3.64548 4.39688C0.533481 9.04588 -0.319519 13.5799 0.0994806 18.0569C0.10038 18.068 0.103603 18.0788 0.108942 18.0887C0.114282 18.0985 0.121619 18.1071 0.130481 18.1139C1.94208 19.4561 3.96859 20.4807 6.12348 21.1439C6.13868 21.148 6.15476 21.1475 6.16971 21.1426C6.18465 21.1376 6.19779 21.1283 6.20748 21.1159C6.66948 20.4859 7.08148 19.8209 7.43348 19.1219C7.4384 19.1123 7.44123 19.1019 7.44181 19.0911C7.44238 19.0804 7.44067 19.0697 7.4368 19.0597C7.43292 19.0497 7.42697 19.0406 7.41933 19.033C7.41169 19.0255 7.40254 19.0196 7.39248 19.0159C6.74572 18.7689 6.11973 18.4706 5.52048 18.1239C5.50949 18.1175 5.50024 18.1086 5.49356 18.0978C5.48688 18.087 5.48297 18.0747 5.48217 18.062C5.48138 18.0494 5.48373 18.0367 5.48902 18.0251C5.49431 18.0136 5.50237 18.0036 5.51248 17.9959C5.63877 17.9015 5.7628 17.8041 5.88448 17.7039C5.8949 17.6948 5.90776 17.689 5.92147 17.6872C5.93517 17.6854 5.94909 17.6878 5.96148 17.6939C9.88948 19.4869 14.1415 19.4869 18.0235 17.6939C18.036 17.6875 18.0501 17.6851 18.064 17.6869C18.0779 17.6887 18.091 17.6946 18.1015 17.7039C18.2215 17.8019 18.3475 17.9019 18.4745 17.9959C18.4845 18.0034 18.4925 18.0133 18.4978 18.0246C18.5031 18.036 18.5056 18.0485 18.505 18.061C18.5044 18.0735 18.5008 18.0857 18.4944 18.0964C18.488 18.1072 18.4791 18.1163 18.4685 18.1229C17.8704 18.4724 17.2438 18.7708 16.5955 19.0149C16.5854 19.0187 16.5762 19.0247 16.5686 19.0323C16.5609 19.04 16.555 19.0491 16.5511 19.0592C16.5472 19.0693 16.5455 19.0801 16.5461 19.0909C16.5467 19.1017 16.5496 19.1123 16.5545 19.1219C16.9145 19.8199 17.3265 20.4839 17.7795 21.1149C17.7892 21.1273 17.8023 21.1366 17.8173 21.1416C17.8322 21.1465 17.8483 21.147 17.8635 21.1429C20.0223 20.4824 22.0522 19.4577 23.8655 18.1129C23.8742 18.1065 23.8815 18.0984 23.887 18.0891C23.8925 18.0799 23.8961 18.0696 23.8975 18.0589C24.3975 12.8819 23.0595 8.38488 20.3485 4.39888C20.3422 4.38538 20.3312 4.37569 20.3175 4.36988ZM8.02048 15.3299C6.83848 15.3299 5.86348 14.2449 5.86348 12.9109C5.86348 11.5779 6.81948 10.4919 8.02048 10.4919C9.23048 10.4919 10.1965 11.5879 10.1775 12.9119C10.1775 14.2449 9.22148 15.3299 8.02048 15.3299ZM15.9955 15.3299C14.8125 15.3299 13.8385 14.2449 13.8385 12.9109C13.8385 11.5779 14.7935 10.4919 15.9955 10.4919C17.2055 10.4919 18.1715 11.5879 18.1525 12.9119C18.1525 14.2449 17.2065 15.3299 15.9955 15.3299Z" fill="currentColor"/>
                                        </g>
                                        <defs>
                                            <clipPath id="clip0_11566_5">
                                                <rect width="24" height="24" fill="white"/>
                                            </clipPath>
                                        </defs>
                                    </svg>

                                    {t("continueWith", { provider: "Discord" })}

                                    {renderLastSignInBadge("discord")}
                                </button>

                                <button className="button button--size-xl button--type-minimal button--with-icon button--active-transform oauth-provider-button" type="button" onClick={handleTelegramClick}>
                                    <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 1.5C17.799 1.5 22.5 6.20101 22.5 12C22.5 17.799 17.799 22.5 12 22.5C6.20101 22.5 1.5 17.799 1.5 12C1.5 6.20101 6.20101 1.5 12 1.5ZM17.2402 7.65625C17.3334 7.05232 16.7587 6.57574 16.2217 6.81152L5.52344 11.5088C5.13847 11.678 5.16698 12.2615 5.56641 12.3887L7.77246 13.0908C8.19357 13.2249 8.64987 13.1554 9.01758 12.9014L13.9912 9.46484C14.1412 9.36146 14.3048 9.575 14.1768 9.70703L10.5957 13.3984C10.2487 13.7565 10.3178 14.363 10.7354 14.625L14.7441 17.1396C15.1937 17.4214 15.7723 17.138 15.8564 16.5947L17.2402 7.65625Z" fill="currentColor"/>
                                    </svg>

                                    {t("continueWith", { provider: "Telegram" })}

                                    {renderLastSignInBadge("telegram")}
                                </button>

                                <button className="button button--size-xl button--type-minimal button--with-icon button--active-transform oauth-provider-button" type="button" onClick={openEmailAuth}>
                                    <svg className="icon" width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>
                                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                                    </svg>

                                    {t("continueWithEmail")}

                                    {renderLastSignInBadge("email")}
                                </button>
                            </div>

                            <div className="auth__footer">
                                <span className="link-button link-button--default" onClick={openDataModal} style={{ cursor: "pointer" }}>
                                    {t("dataModal.title")}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            <EmailLoginAuth isOpen={isOpen && isEmailAuthOpen} onBack={() => setIsEmailAuthOpen(false)} onClose={closeEmailAuth} />

            <Modal closeTimeoutMS={150} isOpen={isDataModalOpen} onRequestClose={closeDataModal} className="modal active" overlayClassName="modal-overlay">
                <div className="modal-window">
                    <div className="modal-window__header">
                        <h2>{t("dataModal.title")}</h2>
                        
                        <button className="icon-button modal-window__close" type="button" onClick={closeDataModal} aria-label={t("close")}>
                            <svg className="icon icon--cross" height="24" width="24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z"></path>
                            </svg>
                        </button>
                    </div>

                    <div className="modal-window__content">
                        <p style={{ marginBottom: "15px" }}>{t("dataModal.intro")}</p>

                        <ul style={{ paddingLeft: "20px", marginBottom: "15px" }}>
                            <li>{t("dataModal.items.usernameAvatar")}</li>
                            <li>{t("dataModal.items.email")}</li>
                        </ul>

                        <p>{t("dataModal.outro")}</p>
                    </div>
                </div>
            </Modal>
        </>
    );
}