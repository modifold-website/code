import ModerationTabs from "@/components/moderation/ModerationTabs";
import { getTranslations } from "next-intl/server";

export default async function Layout({ children }) {
    const t = await getTranslations("ModerationPage");
    
    return (
        <div className="layout">
            <div className="page-content moderation-page">
                <h1 className="moderation--title">{t("title")}</h1>

                <ModerationTabs />
                
                {children}
            </div>
        </div>
    );
}