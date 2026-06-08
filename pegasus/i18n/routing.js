import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
    locales: ["ru", "en", "es", "pt", "uk", "tr"],
    defaultLocale: "en",
    localePrefix: "never",
    localeDetection: true,
    localeCookie: {
        name: "NEXT_LOCALE",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
    },
});