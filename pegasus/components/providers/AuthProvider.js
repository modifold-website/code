"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { commitPendingSignInProvider } from "@/utils/authSignInProvider";

const AuthContext = createContext();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const removeAuthToken = () => {
	Cookies.remove("authToken", { path: "/" });

	if(window.location.hostname === "modifold.com" || window.location.hostname.endsWith(".modifold.com")) {
		Cookies.remove("authToken", { path: "/", domain: ".modifold.com" });
	}

	localStorage.removeItem("authToken");
};

export function AuthProvider({ children, isLoggedIn, userData }) {
    const [isLoggedInState, setIsLoggedIn] = useState(isLoggedIn);
    const [user, setUser] = useState(userData);

    const fetchCurrentUser = useCallback(async (token) => {
        let lastError = null;

        for(let attempt = 0; attempt < 3; attempt++) {
            try {
                const userResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/user`, {
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    cache: "no-store",
                    credentials: "include",
                });

                const freshUserData = await userResponse.json().catch(() => ({}));
                if(userResponse.ok && freshUserData.success) {
                    return freshUserData.user;
                }

                lastError = new Error(freshUserData?.message || "Failed to fetch user data");
            } catch (error) {
                lastError = error;
            }

            await wait(150 * (attempt + 1));
        }

        throw lastError || new Error("Failed to fetch user data");
    }, []);

    const completeLogin = useCallback(async (token) => {
        const freshUser = await fetchCurrentUser(token);

		removeAuthToken();
		Cookies.set("authToken", token, { expires: 30, path: "/", sameSite: "lax", secure: window.location.protocol === "https:" });
		localStorage.setItem("authToken", token);
        setIsLoggedIn(true);
        setUser(freshUser);

        return freshUser;
    }, [fetchCurrentUser]);

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
		removeAuthToken();
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