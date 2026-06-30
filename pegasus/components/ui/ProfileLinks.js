"use client";

import { useTranslations } from "next-intl";

const getSafeExternalUrl = (value) => {
    if(typeof value !== "string") {
        return null;
    }

    try {
        const parsed = new URL(value);
        if(parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
};

export default function ProfileLinks({ socialLinks = {} }) {
    const t = useTranslations("ProfilePage");
    const tLinks = useTranslations("Organizations.settings.links");
    const discordUrl = getSafeExternalUrl(socialLinks?.discord);
    const xUrl = getSafeExternalUrl(socialLinks?.x);
    const telegramUrl = getSafeExternalUrl(socialLinks?.telegram);
    const youtubeUrl = getSafeExternalUrl(socialLinks?.youtube);

    if(!discordUrl && !xUrl && !telegramUrl && !youtubeUrl) {
        return null;
    }

    return (
        <div className="content content--padding">
            <h2>{t("linksTitle")}</h2>

            <ul className="links-list">
                {discordUrl && (
                    <li>
                        <a href={discordUrl} target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M20.3 5.6A16.4 16.4 0 0 0 16.2 4l-.2.3c-.2.4-.4.7-.5 1.1a15.3 15.3 0 0 0-7 0 8 8 0 0 0-.7-1.4 16 16 0 0 0-4.1 1.6C1.1 9.5.5 13.3.9 17c1.7 1.3 3.4 2 5 2.5.4-.5.7-1.1 1-1.7-.6-.2-1.1-.5-1.6-.8l.4-.3c3.4 1.6 7 1.6 10.3 0l.4.3c-.5.3-1 .6-1.6.8.3.6.6 1.2 1 1.7 1.7-.5 3.3-1.3 5-2.5.6-4.3-.7-8.1-2.5-11.4ZM8.3 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" fill="currentColor"></path>
                            </svg>
                            
                            {tLinks("fields.discord")}

                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M15 3h6v6"></path>
                                <path d="M10 14 21 3"></path>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            </svg>
                        </a>
                    </li>
                )}

                {xUrl && (
                    <li>
                        <a href={xUrl} target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"></path>
                            </svg>

                            {tLinks("fields.twitter")}

                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M15 3h6v6"></path>
                                <path d="M10 14 21 3"></path>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            </svg>
                        </a>
                    </li>
                )}

                {telegramUrl && (
                    <li>
                        <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 32 32" aria-hidden="true">
                                <path d="M22.122 10.04c.209 0 .403.065.562.177.116.101.194.243.213.403.02.122.031.262.031.405 0 .065-.002.129-.007.193-.225 2.369-1.201 8.114-1.697 10.766-.21 1.123-.623 1.499-1.023 1.535-.869.081-1.529-.574-2.371-1.126-1.318-.865-2.063-1.403-3.342-2.246-1.479-.973-.52-1.51.322-2.384.221-.23 4.052-3.715 4.127-4.031.004-.019.006-.04.006-.062 0-.078-.029-.149-.076-.203-.052-.034-.117-.053-.185-.053-.045 0-.088.009-.128.024q-.198.045-6.316 4.174c-.445.351-1.007.573-1.619.599-.867-.105-1.654-.298-2.401-.573-.938-.306-1.683-.467-1.619-.985q.051-.404 1.114-.827 6.548-2.853 8.733-3.761c1.607-.853 3.47-1.555 5.429-2.01zM15.93 1.025c-8.302.02-15.025 6.755-15.025 15.06 0 8.317 6.742 15.06 15.06 15.06s15.06-6.742 15.06-15.06c0-8.305-6.723-15.04-15.023-15.06h-.072z" fill="currentColor"></path>
                            </svg>

                            {tLinks("fields.telegram")}

                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M15 3h6v6"></path>
                                <path d="M10 14 21 3"></path>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            </svg>
                        </a>
                    </li>
                )}

                {youtubeUrl && (
                    <li>
                        <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9.6 15.4988V8.50128L15.84 12L9.6 15.4988Z" fill="var(--theme-color-background-content)"></path>
                                <path d="M23.4937 6.38795C23.3571 5.89505 23.0897 5.44564 22.7181 5.08471C22.3466 4.72377 21.884 4.46396 21.3766 4.33129C19.5082 3.84003 12 3.84003 12 3.84003C12 3.84003 4.49183 3.84003 2.62336 4.33129C2.11599 4.46396 1.6534 4.72377 1.28186 5.08471C.910331 5.44564.642899 5.89505.506332 6.38795C.157447 8.23915-.0118575 10.1181.00064491 12C-.0118575 13.882.157447 15.7609.506332 17.6121C.642899 18.105.910331 18.5544 1.28186 18.9153C1.6534 19.2763 2.11599 19.5361 2.62336 19.6688C4.49183 20.16 12 20.16 12 20.16C12 20.16 19.5082 20.16 21.3766 19.6688C21.884 19.5361 22.3466 19.2763 22.7181 18.9153C23.0897 18.5544 23.3571 18.105 23.4937 17.6121C23.8426 15.7609 24.0119 13.882 23.9994 12C24.0119 10.1181 23.8426 8.23915 23.4937 6.38795ZM9.60013 15.4972V8.50288L15.8312 12L9.60013 15.4972Z" fill="currentColor"></path>
                            </svg>

                            {tLinks("fields.youtube")}

                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M15 3h6v6"></path>
                                <path d="M10 14 21 3"></path>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            </svg>
                        </a>
                    </li>
                )}
            </ul>
        </div>
    );
}