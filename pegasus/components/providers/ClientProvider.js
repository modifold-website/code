"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function ClientProvider({ children }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isPopstateRef = useRef(false);

    useEffect(() => {
        const handlePopState = () => {
            isPopstateRef.current = true;
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    useEffect(() => {
        if(isPopstateRef.current) {
            isPopstateRef.current = false;
            return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [pathname, searchParams]);

    return <>{children}</>;
}