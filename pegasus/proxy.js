import { routing } from "./i18n/routing";
import { NextResponse } from "next/server";

export default async function proxy(req) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "https://api.modifold.com";
    let apiHost = "api.modifold.com";

    try {
        apiHost = new URL(apiBase).host;
    } catch (error) {
        console.warn("Invalid NEXT_PUBLIC_API_BASE:", apiBase, error);
    }
    
    let resolvedLocale = req.cookies.get("NEXT_LOCALE")?.value;

    if(!resolvedLocale || !routing.locales.includes(resolvedLocale)) {
        const pathLocale = req.nextUrl.pathname.split("/")[1];
        if(routing.locales.includes(pathLocale)) {
            resolvedLocale = pathLocale;
        } else {
            const acceptLanguage = (req.headers.get("accept-language") || "").toLowerCase();
            const preferred = acceptLanguage.split(",").map(l => l.split(";")[0].trim());

            const localeMap = {
                "ru": "ru",
                "ru-ru": "ru",
                "en": "en",
                "en-us": "en",
                "en-gb": "en",
                "es": "es",
                "es-es": "es",
                "es-mx": "es",
                "pt": "pt",
                "pt-br": "pt",
                "pt-pt": "pt",
                "uk": "uk",
                "uk-ua": "uk",
                "tr": "tr",
                "tr-tr": "tr",
            };

            for(const lang of preferred) {
                if(localeMap[lang]) {
                    resolvedLocale = localeMap[lang];
                    break;
                }
            }

            if(!resolvedLocale) {
                resolvedLocale = acceptLanguage ? "en" : routing.defaultLocale;
            }
        }
    }

    const getThemePreference = () => {
        const themeCookie = req.cookies.get("theme")?.value;
        if(themeCookie === "dark" || themeCookie === "light" || themeCookie === "system") {
            return themeCookie;
        }

        return "light";
    };

    const resolveThemeClass = (themePreference) => {
        if(themePreference === "dark" || themePreference === "light") {
            return themePreference;
        }

        const prefersColorScheme = (req.headers.get("sec-ch-prefers-color-scheme") || "").replace(/"/g, "").toLowerCase();
        return prefersColorScheme === "dark" ? "dark" : "light";
    };

    const themePreference = getThemePreference();
    const resolvedThemeClass = resolveThemeClass(themePreference);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-modifold-theme-preference", themePreference);
    requestHeaders.set("x-modifold-theme", resolvedThemeClass);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });
    const requestHost = req.headers.get("host") || "";
    const isStagingHost = requestHost === "staging.modifold.com" || requestHost.startsWith("staging.");

    if(isStagingHost) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
    }

    response.cookies.set("NEXT_LOCALE", resolvedLocale, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
    });
    response.headers.set("Accept-CH", "Sec-CH-Prefers-Color-Scheme");
    response.headers.set("Critical-CH", "Sec-CH-Prefers-Color-Scheme");

    const clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || req.ip || "unknown";

    if(req.nextUrl.pathname.startsWith("/api") || req.url.includes(apiHost)) {
        requestHeaders.set("X-Real-IP", clientIp);
        requestHeaders.set("X-Forwarded-For", clientIp);
        requestHeaders.set("x-modifold-locale", resolvedLocale);

        const rewriteResponse = NextResponse.next({
            request: { headers: requestHeaders },
        });

        if(isStagingHost) {
            rewriteResponse.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
        }

        rewriteResponse.cookies.set("NEXT_LOCALE", resolvedLocale, {
            maxAge: 60 * 60 * 24 * 365,
            path: "/",
            sameSite: "lax",
        });
        rewriteResponse.headers.set("Accept-CH", "Sec-CH-Prefers-Color-Scheme");
        rewriteResponse.headers.set("Critical-CH", "Sec-CH-Prefers-Color-Scheme");

        return rewriteResponse;
    }

    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|api|_vercel|.*\\..*).*)"],
};