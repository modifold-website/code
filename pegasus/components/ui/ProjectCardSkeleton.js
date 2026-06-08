export default function ProjectCardSkeleton() {
    return (
        <div className="new-project-card skeleton">
            <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--theme-color-border)", paddingBottom: "12px", paddingTop: "16px", paddingRight: "16px", paddingLeft: "16px" }}>
                <div className="skeleton-square" style={{ width: "100px", height: "100px" }}></div>

                <div className="new-project-info">
                    <div className="new-project-header" style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                        <div className="skeleton-bar" style={{ width: "96px", height: "20px" }}></div>
                        <div className="skeleton-bar" style={{ width: "24px", height: "20px" }}></div>
                        <div className="skeleton-bar" style={{ width: "76px", height: "20px" }}></div>
                    </div>

                    <div className="skeleton-bar" style={{ width: "100%", maxWidth: "600px", height: "19px" }}></div>
                </div>
            </div>

            <div className="new-project-tags" style={{ padding: "8px 16px" }}>
                <div className="skeleton-bar" style={{ width: "16px", height: "16px" }}></div>
                <div className="skeleton-bar" style={{ width: "111px", height: "24px" }}></div>
                <div className="skeleton-bar" style={{ width: "111px", height: "24px" }}></div>
                <div className="skeleton-bar" style={{ width: "111px", height: "24px" }}></div>
            </div>
        </div>
    );
}