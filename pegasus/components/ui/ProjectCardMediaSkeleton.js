export default function ProjectCardMediaSkeleton() {
    return (
        <div className="media-project-card skeleton">
            <div className="media-project-cover" style={{ background: "var(--theme-color-border)" }}></div>

            <div className="media-project-body">
                <div className="media-project-header">
                    <div className="skeleton-square" style={{ width: "64px", height: "64px", flexShrink: 0, borderRadius: "12px" }}></div>

                    <div className="media-project-header-text">
                        <div className="media-project-title-row">
                            <div className="skeleton-bar" style={{ height: "19px", width: "100px" }}></div>
                            <div className="skeleton-bar" style={{ height: "19px", width: "32px" }}></div>
                            <div className="skeleton-bar" style={{ height: "19px", width: "70px" }}></div>
                        </div>

                        <div className="skeleton__group">
                            <div className="skeleton-bar" style={{ height: "16px", width: "330px", marginBottom: "4px" }}></div>
                            <div className="skeleton-bar" style={{ height: "16px", width: "190px" }}></div>
                        </div>
                    </div>
                </div>

                <div className="media-project-tags">
                    <div className="skeleton-bar" style={{ height: "24px", width: "65px" }}></div>
                    <div className="skeleton-bar" style={{ height: "24px", width: "100px" }}></div>
                    <div className="skeleton-bar" style={{ height: "24px", width: "78px" }}></div>
                    <div className="skeleton-bar" style={{ height: "24px", width: "50px" }}></div>
                    <div className="skeleton-bar" style={{ height: "24px", width: "65px" }}></div>
                    <div className="skeleton-bar" style={{ height: "24px", width: "65px" }}></div>
                </div>

                <div className="media-project-stats">
                    <div className="media-project-stat" title="downloads">
                        <div className="skeleton-bar" style={{ height: "20px", width: "20px" }}></div>
                        <div className="skeleton-bar" style={{ height: "18px", width: "30px" }}></div>
                    </div>

                    <div className="media-project-stat" title="followers">
                        <div className="skeleton-bar" style={{ height: "20px", width: "20px" }}></div>
                        <div className="skeleton-bar" style={{ height: "18px", width: "18px" }}></div>
                    </div>

                    <div className="media-project-stat media-project-updated" title="12 days ago">
                        <div className="skeleton-bar" style={{ height: "20px", width: "20px" }}></div>
                        <div className="skeleton-bar" style={{ height: "18px", width: "84px" }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}