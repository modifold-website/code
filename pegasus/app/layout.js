import Header from "@/components/layout/Header";
import HeaderMobile from "@/components/layout/HeaderMobile";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import ClientProvider from "@/components/providers/ClientProvider";
import CookieBanner from "@/components/ui/CookieBanner";
import RippleEffects from "@/components/ui/RippleEffects";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import FooterModrinthModal from "@/modal/FooterModrinthModal";
import { parseFeatureFlagsCookieValue } from "@/utils/featureFlags";
import { Inter } from "next/font/google";

const inter = Inter({
	subsets: ["latin", "cyrillic"],
	display: "swap",
});
const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function generateMetadata() {
    const resolvedLocale = await getLocale();
    const messages = (await import(`../i18n/messages/${resolvedLocale}.json`)).default;

    return {
        title: messages.HomePage.title,
        description: messages.HomePage.description,
        keywords: "Hytale mods, shaders, resource packs, modpacks, maps, download Hytale maps, Modifold, download mods Hytale",
        robots: "index, follow",
        openGraph: {
            title: messages.HomePage.title,
            description: messages.HomePage.description,
            url: "https://modifold.com/",
            site_name: "Modifold",
            locale: "en_US",
            type: "website",
            images: [
                {
                    url: "https://modifold.com/images/banner.png?v=3",
                    width: 1200,
                    height: 630,
                    alt: "Modifold Banner",
                }
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: messages.HomePage.title,
            description: messages.HomePage.description,
            images: ["https://modifold.com/images/banner.png?v=3"],
            site: "@modifold",
        },
    };
}

export default async function RootLayout({ children }) {
    const resolvedLocale = await getLocale();
    const cookieStore = await cookies();
    const requestHeaders = await headers();
    const token = cookieStore.get("authToken")?.value || null;
    const themeCookie = cookieStore.get("theme")?.value;
    const featureFlagsCookie = cookieStore.get("featureFlags")?.value;
    const featureFlags = parseFeatureFlagsCookieValue(featureFlagsCookie);
    const isFrostedMenusEnabled = featureFlags.frostedMenus === true;
    const messages = (await import(`../i18n/messages/${resolvedLocale}.json`)).default;
    const isStaging = process.env.NEXT_PUBLIC_API_BASE?.includes("staging");

    let userData = null;
    let isLoggedIn = false;

    if(token) {
        try {
            const response = await fetch(`${apiBase}/auth/user`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });

            if(response.ok) {
                const data = await response.json().catch(() => ({}));
                if(data.success && data.user) {
                    userData = data.user;
                    isLoggedIn = true;
                }
            } else {
                console.error("API error:", response.status, response.statusText);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        }
    }

    const themeFromProxy = requestHeaders.get("x-modifold-theme");
    const themePreferenceFromProxy = requestHeaders.get("x-modifold-theme-preference");
    const normalizedThemeCookie = themeCookie === "dark" || themeCookie === "light" || themeCookie === "system" ? themeCookie : "light";
    const initialTheme = themeFromProxy === "dark" || themeFromProxy === "light" ? themeFromProxy : normalizedThemeCookie === "dark" ? "dark" : "light";
    const themePreference = themePreferenceFromProxy === "dark" || themePreferenceFromProxy === "light" || themePreferenceFromProxy === "system" ? themePreferenceFromProxy : normalizedThemeCookie;

    return (
        <html lang={resolvedLocale}>
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no" />

                <link rel="alternate" hrefLang="x-default" href="https://modifold.com/" />

                <link rel="shortcut icon" href="/images/favicon.ico" />
                <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon-180x180.png" />
                <link rel="icon" type="image/png" href="/images/apple-touch-icon-180x180.png" />
                <link rel="icon" href="/images/favicon.ico" type="image/x-icon" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="yandex-tableau-widget" href="/ya_tableau.json?v=1" />
                <link rel="apple-touch-icon" href="/images/Modifold icon.png" />

                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta property="og:site_name" content="Modifold" />
                <meta property="og:image:width" content="600" />
                <meta property="og:image:height" content="315" />
                <meta property="og:type" content="website" />
                <meta property="robots" content="all" />

                <Script src="https://www.googletagmanager.com/gtag/js?id=G-P5V8PSTGNR" strategy="afterInteractive" />
                <Script id="google-analytics" strategy="afterInteractive">
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', 'G-P5V8PSTGNR');
                    `}
                </Script>

                <meta name="yandex-verification" content="f4ef5ccaa38a277f" />
                
                <Script id="yandex-metrika" strategy="afterInteractive">
                    {`
                        (function(m,e,t,r,i,k,a){
                            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                            m[i].l=1*new Date();
                            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
                            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
                        })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=104468237', 'ym');
                        ym(104468237, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
                    `}
                </Script>
            </head>

            <body data-font-smoothing="Antialiased" className={`${inter.className} ${initialTheme}`} data-theme-preference={themePreference} data-feature-flag-frosted-menus={isFrostedMenusEnabled ? "true" : "false"}>
                <div id="app">
                    <AuthProvider isLoggedIn={isLoggedIn} userData={userData}>
                        <ClientProvider>
                            <NextIntlClientProvider locale={resolvedLocale} messages={messages}>
                                <Header authToken={token} />
                                <HeaderMobile authToken={token} />

                                {isStaging && (
                                    <div role="note" className="staging__banner">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0M12 9v4M12 17h.01"></path>
                                        </svg>
                                        
                                        {messages.Layout?.stagingBanner || "Staging environment: internal testing only. Some features may be unavailable or unstable."}
                                    </div>
                                )}

                                {children}

                                <footer className="layout__footer">
                                    <div className="footer-root">
                                        <div className="footer-container">
                                            <div className="footer-inner">
                                                <div className="footer-col">
                                                    <div className="footer-logos">
                                                        <a href="/" className="footer-logo__link" aria-label={messages.Header.home}>
                                                            <svg width="140" height="45" viewBox="0 0 287 73" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <path d="M76.51 52V23.92H81.154L82.288 27.916C83.044 26.584 84.088 25.504 85.42 24.676C86.752 23.812 88.354 23.38 90.226 23.38C92.098 23.38 93.772 23.83 95.248 24.73C96.724 25.63 97.822 26.872 98.542 28.456C99.226 27.052 100.306 25.864 101.782 24.892C103.294 23.884 105.076 23.38 107.128 23.38C109.072 23.38 110.8 23.884 112.312 24.892C113.86 25.864 115.048 27.232 115.876 28.996C116.74 30.724 117.172 32.704 117.172 34.936V52H110.962V35.53C110.962 33.586 110.458 32.002 109.45 30.778C108.442 29.554 107.128 28.942 105.508 28.942C103.888 28.942 102.556 29.572 101.512 30.832C100.468 32.056 99.946 33.622 99.946 35.53V52H93.736V35.53C93.736 33.586 93.232 32.002 92.224 30.778C91.216 29.554 89.902 28.942 88.282 28.942C86.662 28.942 85.33 29.572 84.286 30.832C83.242 32.056 82.72 33.622 82.72 35.53V52H76.51ZM134.61 52.54C131.73 52.54 129.138 51.928 126.834 50.704C124.566 49.444 122.784 47.716 121.488 45.52C120.228 43.288 119.598 40.768 119.598 37.96C119.598 35.152 120.228 32.65 121.488 30.454C122.784 28.222 124.566 26.494 126.834 25.27C129.138 24.01 131.73 23.38 134.61 23.38C137.49 23.38 140.064 24.01 142.332 25.27C144.636 26.494 146.418 28.222 147.678 30.454C148.974 32.65 149.622 35.152 149.622 37.96C149.622 40.768 148.974 43.288 147.678 45.52C146.418 47.716 144.636 49.444 142.332 50.704C140.064 51.928 137.49 52.54 134.61 52.54ZM134.61 46.87C137.13 46.87 139.182 46.06 140.766 44.44C142.35 42.784 143.142 40.624 143.142 37.96C143.142 35.296 142.35 33.154 140.766 31.534C139.182 29.878 137.13 29.05 134.61 29.05C132.09 29.05 130.038 29.878 128.454 31.534C126.87 33.154 126.078 35.296 126.078 37.96C126.078 40.624 126.87 42.784 128.454 44.44C130.038 46.06 132.09 46.87 134.61 46.87ZM164.417 52.54C161.789 52.54 159.431 51.928 157.343 50.704C155.255 49.444 153.617 47.716 152.429 45.52C151.277 43.288 150.701 40.768 150.701 37.96C150.701 35.152 151.277 32.65 152.429 30.454C153.617 28.222 155.255 26.494 157.343 25.27C159.431 24.01 161.789 23.38 164.417 23.38C166.685 23.38 168.701 23.848 170.465 24.784C172.229 25.684 173.669 26.818 174.785 28.186V13.93H180.995V52H176.351L175.055 47.464C173.903 48.868 172.427 50.074 170.627 51.082C168.827 52.054 166.757 52.54 164.417 52.54ZM165.929 46.978C168.557 46.978 170.681 46.15 172.301 44.494C173.957 42.802 174.785 40.624 174.785 37.96C174.785 35.296 173.957 33.136 172.301 31.48C170.681 29.788 168.557 28.942 165.929 28.942C163.337 28.942 161.231 29.788 159.611 31.48C157.991 33.136 157.181 35.296 157.181 37.96C157.181 40.624 157.991 42.802 159.611 44.494C161.231 46.15 163.337 46.978 165.929 46.978ZM192.066 52H185.856V23.92H192.066V52ZM188.988 19.924C187.836 19.924 186.9 19.582 186.18 18.898C185.46 18.178 185.1 17.26 185.1 16.144C185.1 15.028 185.46 14.11 186.18 13.39C186.936 12.67 187.872 12.31 188.988 12.31C190.104 12.31 191.022 12.67 191.742 13.39C192.462 14.11 192.822 15.028 192.822 16.144C192.822 17.26 192.462 18.178 191.742 18.898C191.022 19.582 190.104 19.924 188.988 19.924ZM204.749 23.92H213.119V29.32H204.749V52H198.539V29.32H193.949V23.92H198.539V22.462C198.539 19.69 199.331 17.584 200.915 16.144C202.535 14.668 204.857 13.93 207.881 13.93H213.119L213.659 19.33H207.881C205.793 19.33 204.749 20.374 204.749 22.462V23.92ZM226.22 52.54C223.34 52.54 220.748 51.928 218.444 50.704C216.176 49.444 214.394 47.716 213.098 45.52C211.838 43.288 211.208 40.768 211.208 37.96C211.208 35.152 211.838 32.65 213.098 30.454C214.394 28.222 216.176 26.494 218.444 25.27C220.748 24.01 223.34 23.38 226.22 23.38C229.1 23.38 231.674 24.01 233.942 25.27C236.246 26.494 238.028 28.222 239.288 30.454C240.584 32.65 241.232 35.152 241.232 37.96C241.232 40.768 240.584 43.288 239.288 45.52C238.028 47.716 236.246 49.444 233.942 50.704C231.674 51.928 229.1 52.54 226.22 52.54ZM226.22 46.87C228.74 46.87 230.792 46.06 232.376 44.44C233.96 42.784 234.752 40.624 234.752 37.96C234.752 35.296 233.96 33.154 232.376 31.534C230.792 29.878 228.74 29.05 226.22 29.05C223.7 29.05 221.648 29.878 220.064 31.534C218.48 33.154 217.688 35.296 217.688 37.96C217.688 40.624 218.48 42.784 220.064 44.44C221.648 46.06 223.7 46.87 226.22 46.87ZM250.411 52H244.201V13.93H250.411V52ZM267.091 52.54C264.463 52.54 262.105 51.928 260.017 50.704C257.929 49.444 256.291 47.716 255.103 45.52C253.951 43.288 253.375 40.768 253.375 37.96C253.375 35.152 253.951 32.65 255.103 30.454C256.291 28.222 257.929 26.494 260.017 25.27C262.105 24.01 264.463 23.38 267.091 23.38C269.359 23.38 271.375 23.848 273.139 24.784C274.903 25.684 276.343 26.818 277.459 28.186V13.93H283.669V52H279.025L277.729 47.464C276.577 48.868 275.101 50.074 273.301 51.082C271.501 52.054 269.431 52.54 267.091 52.54ZM268.603 46.978C271.231 46.978 273.355 46.15 274.975 44.494C276.631 42.802 277.459 40.624 277.459 37.96C277.459 35.296 276.631 33.136 274.975 31.48C273.355 29.788 271.231 28.942 268.603 28.942C266.011 28.942 263.905 29.788 262.285 31.48C260.665 33.136 259.855 35.296 259.855 37.96C259.855 40.624 260.665 42.802 262.285 44.494C263.905 46.15 266.011 46.978 268.603 46.978Z" fill="currentColor" />
                                                                <path d="M30.8414 1.17779C31.2484 0.940732 31.7515 0.94074 32.1585 1.17779L62.3522 18.7702C62.7533 19.0039 63 19.4325 63 19.8961V53.2961C63 53.762 62.7509 54.1925 62.3468 54.4253L32.1531 71.8253C31.7489 72.0582 31.251 72.0583 30.8468 71.8253L0.653107 54.4253C0.248963 54.1925 0 53.762 0 53.2961V19.8961C8.9039e-06 19.4325 0.246626 19.0039 0.64771 18.7702L30.8414 1.17779ZM3.48082 21.1032V52.0932L31.5001 68.2903L59.5194 52.0932V21.1032L31.5001 4.70553L3.48082 21.1032ZM56.2998 22.7078V50.5889L31.5001 64.6798L6.70042 50.5889V22.7078L31.5001 8.31602L56.2998 22.7078ZM9.99776 48.9341L30.1938 60.4676V37.7014L9.99776 26.2682V48.9341ZM33.1077 37.7346V60.3673L53.2033 48.9015V26.1679L33.1077 37.7346ZM28.0838 52.7454V56.3729L25.0695 54.651V51.0405L28.0838 52.7454ZM38.1316 54.6509L35.1173 56.3728V52.7453L38.1316 51.0404V54.6509ZM15.2226 45.5245V49.1349L12.1078 47.43V43.8195L15.2226 45.5245ZM51.0933 47.4299L47.9784 49.1348V45.5244L51.0933 43.8194V47.4299ZM22.658 40.3093V47.0288L17.0312 43.9198V37.2003L22.658 40.3093ZM46.1698 43.9197L40.5431 47.0287V40.3092L46.1698 37.2002V43.9197ZM28.1843 39.4067V43.2177L25.0695 41.5128V37.7017L28.1843 39.4067ZM38.1316 41.5127L35.0168 43.2176V39.4066L38.1316 37.7016V41.5127ZM15.2226 32.3863V35.9968L12.1078 34.2918V30.6813L15.2226 32.3863ZM51.0933 34.2917L47.9784 35.9967V32.3862L51.0933 30.6812V34.2917Z" fill="#2041DA" />
                                                            </svg>
                                                        </a>
                                                    </div>

                                                    <div class="footer-social">
                                                        <a href="https://t.me/modifold" target="_blank" rel="noopener noreferrer">
                                                            <svg width="24" height="24" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
                                                                <path d="M22.122 10.040c0.006-0 0.014-0 0.022-0 0.209 0 0.403 0.065 0.562 0.177l-0.003-0.002c0.116 0.101 0.194 0.243 0.213 0.403l0 0.003c0.020 0.122 0.031 0.262 0.031 0.405 0 0.065-0.002 0.129-0.007 0.193l0-0.009c-0.225 2.369-1.201 8.114-1.697 10.766-0.21 1.123-0.623 1.499-1.023 1.535-0.869 0.081-1.529-0.574-2.371-1.126-1.318-0.865-2.063-1.403-3.342-2.246-1.479-0.973-0.52-1.51 0.322-2.384 0.221-0.23 4.052-3.715 4.127-4.031 0.004-0.019 0.006-0.040 0.006-0.062 0-0.078-0.029-0.149-0.076-0.203l0 0c-0.052-0.034-0.117-0.053-0.185-0.053-0.045 0-0.088 0.009-0.128 0.024l0.002-0.001q-0.198 0.045-6.316 4.174c-0.445 0.351-1.007 0.573-1.619 0.599l-0.006 0c-0.867-0.105-1.654-0.298-2.401-0.573l0.074 0.024c-0.938-0.306-1.683-0.467-1.619-0.985q0.051-0.404 1.114-0.827 6.548-2.853 8.733-3.761c1.607-0.853 3.47-1.555 5.429-2.010l0.157-0.031zM15.93 1.025c-8.302 0.020-15.025 6.755-15.025 15.060 0 8.317 6.742 15.060 15.060 15.060s15.060-6.742 15.060-15.060c0-8.305-6.723-15.040-15.023-15.060h-0.002q-0.035-0-0.070 0z" fill="currentColor"></path>
                                                            </svg>
                                                        </a>

                                                        <a href="https://x.com/modifold" target="_blank" rel="noopener noreferrer">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                                <path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"></path>
                                                            </svg>
                                                        </a>

                                                        <a href="https://bsky.app/profile/modifold.com" target="_blank" rel="noopener noreferrer">
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <g clip-path="url(#clip0_1382_10)">
                                                                    <path d="M1.82811 1.94059C1.19061 2.11871 0.885924 2.43746 0.670299 3.16402C0.553111 3.56246 0.557799 4.80465 0.674986 6.18746C0.684361 6.27652 0.707799 6.52027 0.721861 6.72652C0.740611 6.93277 0.764049 7.17652 0.773424 7.26559C0.782799 7.35465 0.801549 7.5984 0.820299 7.80465C0.848424 8.1984 0.928111 8.94371 0.960924 9.14059C0.970299 9.20621 0.989049 9.38434 1.0078 9.53902C1.03592 9.78746 1.06874 9.9984 1.14374 10.3406C1.1953 10.5937 1.43905 11.1187 1.66405 11.4656C2.1703 12.2484 2.98124 12.8812 3.86717 13.1953C3.99842 13.2375 4.14374 13.2937 4.1953 13.3171C4.33592 13.3781 5.04374 13.5328 5.36717 13.575C5.52186 13.5937 5.89686 13.6125 6.19686 13.6125C6.49686 13.6171 6.73124 13.6312 6.71249 13.6453C6.68436 13.664 6.4078 13.725 5.78905 13.8468C5.73749 13.8562 5.56874 13.8984 5.41405 13.9453C5.25936 13.9875 5.07186 14.039 4.99217 14.0578C4.7578 14.1234 4.14842 14.3765 3.84374 14.5406C3.41717 14.7703 3.0328 15.0984 2.81717 15.4218C2.5828 15.7734 2.53124 15.9468 2.49842 16.439C2.44217 17.2828 2.93436 18.3656 3.95155 19.6312C4.99217 20.9296 6.02342 21.7406 7.05936 22.0875C7.47186 22.2234 8.15155 22.2328 8.5078 22.1062C9.35155 21.8062 10.0687 21.0328 10.725 19.7109C11.0859 18.9843 11.6109 17.5828 11.8828 16.5984C11.9719 16.2843 12.0187 16.2421 12.0656 16.439C12.1078 16.6218 12.1922 16.9078 12.4922 17.925C13.1859 20.2406 13.9219 21.4593 14.9109 21.9093C15.2578 22.0687 15.4219 22.0968 15.9375 22.0921C16.4437 22.0875 16.8844 21.9656 17.4609 21.6656C17.8922 21.4406 18.7125 20.9109 18.8437 20.7656C18.8578 20.7515 18.9609 20.6671 19.0781 20.5734C19.3219 20.3765 19.7859 19.9031 20.039 19.5937C20.1328 19.4765 20.2453 19.3406 20.2875 19.289C20.4187 19.1343 20.8594 18.45 20.8594 18.4031C20.8594 18.3796 20.8875 18.3234 20.925 18.2859C20.9625 18.2437 21.0562 18.0187 21.1406 17.789C21.6469 16.3406 21.0797 15.1734 19.4765 14.3812C18.8672 14.0765 18.1078 13.8281 17.4375 13.7062C17.0953 13.6406 17.1844 13.6171 17.7562 13.6125C18.9469 13.6078 19.95 13.364 20.85 12.8625C21.9797 12.2296 22.8234 11.0062 22.9453 9.82027C22.964 9.64215 22.9828 9.48277 22.9922 9.46871C23.0015 9.44527 23.0156 9.33746 23.0859 8.68121C23.1 8.5734 23.1187 8.39527 23.1328 8.28277C23.1422 8.17496 23.1656 7.9359 23.1844 7.75777C23.1984 7.57496 23.2172 7.35465 23.2265 7.26559C23.2359 7.17652 23.2594 6.90934 23.2734 6.67965C23.2922 6.44527 23.3109 6.18277 23.3203 6.09371C23.414 5.13746 23.4422 3.84371 23.3812 3.47809C23.2594 2.7609 23.0062 2.32027 22.5937 2.10934C21.6422 1.62184 20.475 1.92184 18.764 3.08902C18.15 3.5109 18.0047 3.6234 17.6015 3.9609C16.1062 5.22652 14.4 7.17184 13.0687 9.14059C12.6422 9.76871 12.0469 10.7531 12.0469 10.8281C12.0469 10.9359 11.9625 10.8609 11.864 10.6593C11.7375 10.3875 11.2312 9.57652 10.8797 9.07027C10.5797 8.63434 9.89061 7.68746 9.8203 7.61246C9.79686 7.58434 9.72186 7.49059 9.65624 7.40621C9.59061 7.32184 9.51561 7.22809 9.49217 7.19996C9.46405 7.17184 9.30936 6.98434 9.1453 6.77809C8.56405 6.06559 7.41092 4.85621 6.74999 4.26559C6.66092 4.1859 6.54374 4.08277 6.49217 4.0359C5.4703 3.12652 3.76405 2.1234 2.9203 1.94527C2.65311 1.88434 2.03436 1.88434 1.82811 1.94059Z" fill="currentColor"></path>
                                                                </g>
                                                                <defs>
                                                                    <clipPath id="clip0_1382_10"><rect width="24" height="24" fill="white"></rect></clipPath>
                                                                </defs>
                                                            </svg>
                                                        </a>

                                                        <a href="https://discord.gg/PgVCEBkwzH" target="_blank" rel="noopener noreferrer">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="71" height="55" fill="none" viewBox="0 0 71 55" class="shrink" aria-hidden="true">
                                                                <g clip-path="url(#a)">
                                                                    <path fill="currentColor" d="M60.105 4.898A58.6 58.6 0 0 0 45.653.415a.22.22 0 0 0-.233.11 41 41 0 0 0-1.8 3.697c-5.456-.817-10.885-.817-16.23 0-.485-1.164-1.201-2.587-1.828-3.697a.23.23 0 0 0-.233-.11 58.4 58.4 0 0 0-14.451 4.483.2.2 0 0 0-.095.082C1.578 18.73-.944 32.144.293 45.39a.24.24 0 0 0 .093.167c6.073 4.46 11.955 7.167 17.729 8.962a.23.23 0 0 0 .249-.082 42 42 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 39 39 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378c.372-.279.744-.569 1.1-.862a.22.22 0 0 1 .23-.03c11.619 5.304 24.198 5.304 35.68 0a.22.22 0 0 1 .233.027c.356.293.728.586 1.103.865a.228.228 0 0 1-.02.378 36.4 36.4 0 0 1-5.54 2.637.227.227 0 0 0-.121.315 47 47 0 0 0 3.624 5.897.225.225 0 0 0 .249.084c5.801-1.794 11.684-4.502 17.757-8.961a.23.23 0 0 0 .092-.164c1.48-15.315-2.48-28.618-10.497-40.412a.18.18 0 0 0-.093-.084m-36.38 32.427c-3.497 0-6.38-3.211-6.38-7.156s2.827-7.156 6.38-7.156c3.583 0 6.438 3.24 6.382 7.156 0 3.945-2.827 7.156-6.381 7.156m23.593 0c-3.498 0-6.38-3.211-6.38-7.156s2.826-7.156 6.38-7.156c3.582 0 6.437 3.24 6.38 7.156 0 3.945-2.798 7.156-6.38 7.156"></path>
                                                                </g>
                                                                <defs>
                                                                    <clipPath id="a"><path fill="#fff" d="M0 0h71v55H0z"></path></clipPath>
                                                                </defs>
                                                            </svg>
                                                        </a>
                                                    </div>

                                                    <p className="footer-opensource">
                                                        <a href="https://github.com/modifold-website" target="_blank" rel="noopener noreferrer">
                                                            {messages.Footer.openSourceSoon}
                                                        </a>
                                                    </p>

                                                    <p className="footer-copyright">{messages.Footer.copyright}</p>
                                                </div>

                                                <div className="footer-col footer-col__wrap">
                                                    <p className="footer-col__header">{messages.Footer.sections}</p>

                                                    <a href="https://docs.modifold.com/" target="_blank" className="footer-link">
                                                        {messages.Footer.apiDocs}
                                                    </a>
                                                </div>

                                                <div className="footer-col footer-col__wrap">
                                                    <p className="footer-col__header">{messages.Footer.community}</p>
                                                    
                                                    <Link href="/news" className="footer-link">
                                                        {messages.Footer.news}
                                                    </Link>
                                                </div>

                                                <div className="footer-col footer-col__wrap">
                                                    <p className="footer-col__header">{messages.Footer.legal}</p>
                                                    
                                                    <Link href="/legal/privacy" className="footer-link">
                                                        {messages.Footer.privacyPolicy}
                                                    </Link>

                                                    <Link href="/legal/terms" className="footer-link">
                                                        {messages.Footer.termsOfUse}
                                                    </Link>

                                                    <Link href="/legal/rules" className="footer-link">
                                                        {messages.Footer.contentRules}
                                                    </Link>

                                                    <Link href="/legal/copyright" className="footer-link">
                                                        {messages.Footer.copyrightPolicy}
                                                    </Link>
                                                </div>

                                                <div className="footer-announcement">
                                                    <p>{messages.Footer.notOfficial}</p>
                                                    
                                                    <span className="footer-announcement__inspired">
                                                        <p>{messages.Footer.inspiredBy}{" "}</p>

                                                        <FooterModrinthModal />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </footer>

                                <CookieBanner />
                                <RippleEffects />

                                <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
                            </NextIntlClientProvider>
                        </ClientProvider>
                    </AuthProvider>
                </div>
            </body>
        </html>
    );
}