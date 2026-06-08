"use client";

import React, { useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useAuth } from "../components/providers/AuthProvider";

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
                const nextPath = getReturnPath();
                const hash = new URLSearchParams({ token: data.twoFactorToken, next: nextPath }).toString();
                window.location.assign(`/auth/two-factor#${hash}`);
                return;
            }

            await completeLogin(data.token);
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

    const handleTelegramClick = () => {
        const botName = "8388910351";
        const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_API_BASE}/auth/telegram-callback`);
        callbackUrl.searchParams.set("next", getReturnPath());
        sessionStorage.setItem("telegramAuthReturnPath", getReturnPath());

        const url = `https://oauth.telegram.org/auth?bot_id=${botName}&origin=${encodeURIComponent(window.location.origin)}&return_to=${encodeURIComponent(callbackUrl.toString())}`;
        redirectTo(url, onClose);
    };

    const handleGitHubClick = () => {
        const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
        const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_API_BASE}/auth/github-callback`);
        const scope = "user:email";
        const state = encodeURIComponent(getReturnPath());
        const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

        redirectTo(url, onClose);
    };

    const handleDiscordClick = () => {
        const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
        const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_API_BASE}/auth/discord-callback`);
        const scope = encodeURIComponent("identify email");
        const state = encodeURIComponent(getReturnPath());
        const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

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
        }
    }, [isOpen]);

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
                                <button className="button button--size-xl button--type-minimal button--with-icon button--active-transform" type="button" onClick={handleGitHubClick}>
                                    <svg className="icon icon--github" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.757-1.333-1.757-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.932 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" fill="var(--theme-color-text-primary)" />
                                    </svg>

                                    {t("continueWith", { provider: "GitHub" })}
                                </button>

                                <button className="button button--size-xl button--type-minimal button--with-icon button--active-transform" type="button" onClick={handleDiscordClick}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="icon">
                                        <path fill="#5865F2" d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 13 13 0 0 0-.617-1.25.08.08 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.1.1 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13 13 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10 10 0 0 0 .372-.292.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03M8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418m7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418"></path>
                                    </svg>

                                    {t("continueWith", { provider: "Discord" })}
                                </button>

                                <button className="button button--size-xl button--type-minimal button--with-icon button--active-transform" type="button" onClick={handleTelegramClick}>
                                    <svg className="icon icon--google_day" width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="16" cy="16" r="14" fill="url(#paint0_linear_5_16430)"></circle>
                                        <path d="M22.9866 10.2088C23.1112 9.40332 22.3454 8.76755 21.6292 9.082L7.36482 15.3448C6.85123 15.5703 6.8888 16.3483 7.42147 16.5179L10.3631 17.4547C10.9246 17.6335 11.5325 17.541 12.0228 17.2023L18.655 12.6203C18.855 12.4821 19.073 12.7665 18.9021 12.9426L14.1281 17.8646C13.665 18.3421 13.7569 19.1512 14.314 19.5005L19.659 22.8523C20.2585 23.2282 21.0297 22.8506 21.1418 22.1261L22.9866 10.2088Z" fill="white"></path>
                                        <defs>
                                            <linearGradient id="paint0_linear_5_16430" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
                                                <stop stopColor="#37BBFE" />
                                                <stop offset="1" stopColor="#007DBB" />
                                            </linearGradient>
                                        </defs>
                                    </svg>

                                    {t("continueWith", { provider: "Telegram" })}
                                </button>

                                <button className="button button--size-xl button--type-minimal button--with-icon button--active-transform" type="button" onClick={openEmailAuth}>
                                    <svg className="icon" width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>
                                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                                    </svg>

                                    {t("continueWithEmail")}
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