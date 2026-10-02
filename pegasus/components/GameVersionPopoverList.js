"use client";

function normalizeGameVersionOption(item) {
    if(typeof item === "string") {
        const version = item.trim();
        return version ? {
            version,
			label: version,
            version_type: version.includes("-pre") ? "pre-release" : "release",
        } : null;
    }

    if(item && typeof item.version === "string") {
        const version = item.version.trim();
        return version ? {
            version,
			label: item.label || version,
            version_type: item.version_type || (version.includes("-pre") ? "pre-release" : "release"),
        } : null;
    }

    return null;
}

export default function GameVersionPopoverList({ gameVersions, selectedVersions, onToggleVersion, releaseLabel, preReleaseLabel }) {
    const groups = (Array.isArray(gameVersions) ? gameVersions : []).reduce((acc, item) => {
        const normalized = normalizeGameVersionOption(item);
        if(!normalized) {
            return acc;
        }

        const group = normalized.version_type === "pre-release" ? "preReleases" : "releases";
		acc[group].push(normalized);
        return acc;
    }, {
        releases: [],
        preReleases: [],
    });

    const renderGroup = (label, versions) => versions.length > 0 ? (
        <div className="context-list-group" key={label}>
            <div className="context-list-group__title">{label}</div>

            {versions.map((item) => (
				<button key={item.version} type="button" className={`context-list-option ${selectedVersions.includes(item.version) ? "context-list-option--selected" : ""}`} style={{ "--press-duration": "140ms" }} onClick={() => onToggleVersion(item.version)} aria-pressed={selectedVersions.includes(item.version)}>
					<span className="context-list-option__label">{item.label}</span>
				</button>
            ))}
        </div>
    ) : null;

    return (
        <>
            {renderGroup(releaseLabel, groups.releases)}
            {renderGroup(preReleaseLabel, groups.preReleases)}
        </>
    );
}