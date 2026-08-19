"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/utils/query/client";
import NavigationProgressBar from "@/components/ui/NavigationProgressBar";

let browserQueryClient;

function getQueryClient() {
    if(typeof window === "undefined") {
        return makeQueryClient();
    }

    if(!browserQueryClient) {
        browserQueryClient = makeQueryClient();
    }

    return browserQueryClient;
}

export default function ClientProvider({ children }) {
    const queryClient = getQueryClient();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isPopstateRef = useRef(false);
    const previousLocationRef = useRef(null);

    useEffect(() => {
        const handlePopState = () => {
            isPopstateRef.current = true;
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    useEffect(() => {
        const queryString = searchParams.toString();
        const location = queryString ? `${pathname}?${queryString}` : pathname;
        const isInitialLocation = previousLocationRef.current === null;

        if(previousLocationRef.current === location) {
            return;
        }

        previousLocationRef.current = location;

        if(isInitialLocation) {
            return;
        }

        if(isPopstateRef.current) {
            isPopstateRef.current = false;
            return;
        }

        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [pathname, searchParams]);

    return (
        <QueryClientProvider client={queryClient}>
            <NavigationProgressBar />
            
            {children}
        </QueryClientProvider>
    );
}