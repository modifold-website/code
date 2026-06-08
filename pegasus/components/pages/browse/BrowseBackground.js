"use client";

import { usePathname } from "next/navigation";

export default function BrowseBackground() {
    const pathname = usePathname();
    const isModpacks = pathname?.startsWith("/modpacks");
    const src = isModpacks ? "/images/background-modpacks.webp" : "/images/background-mods.webp";

    return <img src={src} className="fixed-background-teleport" alt="" aria-hidden="true" />;
}