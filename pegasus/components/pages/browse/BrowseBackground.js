"use client";

import { usePathname } from "next/navigation";

export default function BrowseBackground() {
    const pathname = usePathname();
    const src = pathname?.startsWith("/worlds") ? "/images/background-worlds.webp" : pathname?.startsWith("/modpacks") ? "/images/background-modpacks.webp" : "/images/background-mods.webp";

    return <img src={src} className="fixed-background-teleport" alt="" aria-hidden="true" />;
}