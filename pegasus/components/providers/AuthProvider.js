"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { commitPendingSignInProvider } from "@/utils/authSignInProvider";

const AuthContext = createContext();

export function AuthProvider({ children, isLoggedIn, userData }) {
    const [isLoggedInState, setIsLoggedIn] = useState(isLoggedIn);
    const [user, setUser] = useState(userData);

    const completeLogin = async (token) => {
        Cookies.set("authToken", token, { expires: 30, path: "/", sameSite: "lax" });
        localStorage.setItem("authToken", token);

        const userResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/user`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const freshUserData = await userResponse.json();
        if(freshUserData.success) {
            setIsLoggedIn(true);
            setUser(freshUserData.user);
            return freshUserData.user;
        }

        throw new Error("Не удалось получить данные пользователя");
    };

    const telegramLogin = async (telegramData) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/telegram-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(telegramData),
            });

            const data = await response.json();
            if(!data.success) {
                throw new Error(data.message);
            }

            if(data.twoFactorRequired && data.twoFactorToken) {
                return { twoFactorRequired: true, twoFactorToken: data.twoFactorToken };
            }

            await completeLogin(data.token);
            return { twoFactorRequired: false };
        } catch (error) {
            console.error("Telegram Login Error:", error);
            throw error;
        }
    };

    const githubLogin = async ({ token }) => {
        try {
            await completeLogin(token);
        } catch (error) {
            console.error("GitHub Login Error:", error);
            throw error;
        }
    };

    const discordLogin = async ({ token }) => {
        try {
            await completeLogin(token);
        } catch (error) {
            console.error("Discord Login Error:", error);
            throw error;
        }
    };

    const logout = () => {
        Cookies.remove("authToken");
        localStorage.removeItem("authToken");
        setIsLoggedIn(false);
        setUser(null);
        window.location.reload();
    };

    useEffect(() => {
        const handleTelegramAuthResult = async () => {
            if(typeof window === "undefined" || !window.location.hash.startsWith("#tgAuthResult=")) {
                return;
            }

            const encodedPayload = window.location.hash.slice("#tgAuthResult=".length);
            const fallbackPath = `${window.location.pathname}${window.location.search}`;
            const nextPath = sessionStorage.getItem("telegramAuthReturnPath") || fallbackPath || "/";

            try {
                const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
                const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
                const binaryPayload = atob(paddedPayload);
                const bytes = Uint8Array.from(binaryPayload, (char) => char.charCodeAt(0));
                const decodedPayload = new TextDecoder().decode(bytes);
                const telegramData = JSON.parse(decodedPayload);

                const result = await telegramLogin(telegramData);
                commitPendingSignInProvider("telegram");
                sessionStorage.removeItem("telegramAuthReturnPath");

                if(result?.twoFactorRequired && result?.twoFactorToken) {
                    const hash = new URLSearchParams({ token: result.twoFactorToken, next: nextPath }).toString();
                    window.location.replace(`/auth/two-factor#${hash}`);
                    return;
                }

                window.location.replace(nextPath);
            } catch (error) {
                console.error("Telegram redirect login error:", error);
                sessionStorage.removeItem("telegramAuthReturnPath");
                window.history.replaceState(null, "", fallbackPath || "/");
            }
        };

        handleTelegramAuthResult();
    }, []);

    return (
        <AuthContext.Provider value={{ isLoggedIn: isLoggedInState, user, setUser, setIsLoggedIn, completeLogin, telegramLogin, githubLogin, discordLogin, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    return useContext(AuthContext);
};