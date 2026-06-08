"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function AuthCallbackClient() {
    const { completeLogin } = useAuth();
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const params = parseHashParams();
        const token = params.get("token");
        const twoFactorRequired = params.get("twofactor");
        const twoFactorToken = params.get("twofactor_token");
        const error = params.get("error");
        const nextPath = getSafeNextPath(params.get("next"));

        if(error) {
            setErrorMessage(error);
            return;
        }

        if(twoFactorRequired && twoFactorToken) {
            const hash = new URLSearchParams({ token: twoFactorToken, next: nextPath }).toString();
            window.location.replace(`/auth/two-factor#${hash}`);
            return;
        }

        if(!token) {
            setErrorMessage("Authentication result is missing.");
            return;
        }

        completeLogin(token).then(() => {
            window.location.replace(nextPath);
        }).catch((loginError) => {
            setErrorMessage(loginError?.message || "Authentication failed.");
        });
    }, [completeLogin]);

    return (
        <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "32px 16px" }}>
            <div style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}>
                {errorMessage ? (
                    <>
                        <h1 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "12px" }}>Authorization error</h1>
                        <p style={{ marginBottom: "16px" }}>{errorMessage}</p>
                        
                        <Link href="/" className="button button--size-l button--type-primary button--active-transform">
                            Return to home
                        </Link>
                    </>
                ) : (
                    <>
                        <h1 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "12px" }}>Completing sign-in</h1>
                        <p>Please wait a moment.</p>
                    </>
                )}
            </div>
        </div>
    );
}