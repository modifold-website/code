import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const SUPPORTED_LOCALES = ["ru", "en", "es", "pt", "uk", "tr"];

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

export default getRequestConfig(async ({ locale, requestLocale }) => {
    const requestLocaleValue = typeof requestLocale === "string" ? requestLocale : await requestLocale;
    let requestedLocale = requestLocaleValue || locale;

    if(!requestedLocale || !SUPPORTED_LOCALES.includes(requestedLocale)) {
        const cookieStore = await cookies();
        const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
        if(cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
            requestedLocale = cookieLocale;
        }
    }

    if(!requestedLocale || !SUPPORTED_LOCALES.includes(requestedLocale)) {
        const headerStore = await headers();
        const acceptLanguage = (headerStore.get("accept-language") || "").toLowerCase();
        const preferred = acceptLanguage.split(",").map((lang) => lang.split(";")[0].trim()).filter(Boolean);

        for(const lang of preferred) {
            if(localeMap[lang]) {
                requestedLocale = localeMap[lang];
                break;
            }
        }
    }

    const validLocale = SUPPORTED_LOCALES.includes(requestedLocale) ? requestedLocale : "en";
    
    return {
        locale: validLocale,
        messages: (await import(`../i18n/messages/${validLocale}.json`)).default,
    };
});