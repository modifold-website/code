import { useMemo } from "react";
import { useTranslations } from "next-intl";

const defaultGameVersions = [];

const mcVersionRegex = /^([0-9]+.[0-9]+)(.[0-9]+)?$/;

function createSingleVersion(label) {
    return { type: "single", label };
}

function createVersionRange(start, end) {
    return { type: "range", start, end };
}

function formatVersion(major, minor) {
    return minor === 0 ? major : `${major}.${minor}`;
}

function groupVersions(versions, consecutive = false) {
    return versions.slice().reverse().reduce((ranges, version) => {
        const matchesVersion = version.match(mcVersionRegex);

        if(matchesVersion) {
            const majorVersion = matchesVersion[1];
            const minorVersion = matchesVersion[2];
            const minorNumeric = minorVersion ? parseInt(minorVersion.replace(".", "")) : 0;

            let prevInRange;
            if((prevInRange = ranges.find((x) => x.major === majorVersion && (!consecutive || x.minor.at(-1) === minorNumeric - 1)))) {
                prevInRange.minor.push(minorNumeric);
                return ranges;
            }

            return [...ranges, { major: majorVersion, minor: [minorNumeric] }];
        }

        return ranges;
    }, []).reverse();
}

function groupConsecutiveIndices(versions, referenceList) {
    if(!versions || versions.length === 0) {
        return [];
    }

    const referenceMap = new Map();
    referenceList.forEach((item, index) => {
        referenceMap.set(item, index);
    });

    const sortedList = versions.slice().sort((a, b) => {
        const left = referenceMap.has(a) ? referenceMap.get(a) : Number.MAX_SAFE_INTEGER;
        const right = referenceMap.has(b) ? referenceMap.get(b) : Number.MAX_SAFE_INTEGER;

        if(left !== right) {
            return left - right;
        }

        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    });

    const ranges = [];
    let start = sortedList[0];
    let previous = sortedList[0];

    for(let i = 1; i < sortedList.length; i++) {
        const current = sortedList[i];
        if(referenceMap.get(current) !== referenceMap.get(previous) + 1) {
            if(start === previous) {
                ranges.push(createSingleVersion(start));
            } else {
                ranges.push(createVersionRange(start, previous));
            }

            start = current;
        }

        previous = current;
    }

    if(start === previous) {
        ranges.push(createSingleVersion(start));
    } else {
        ranges.push(createVersionRange(start, previous));
    }

    return ranges;
}

function formatVersionsForDisplay(gameVersions, allGameVersions = defaultGameVersions) {
    const inputVersions = gameVersions.slice();
    const allVersions = [...new Set([...allGameVersions, ...inputVersions])];

    const allReleases = allVersions.filter((version) => mcVersionRegex.test(version));
    const allLegacy = allVersions.filter((version) => !mcVersionRegex.test(version));

    const indices = allVersions.reduce((map, gameVersion, index) => {
        map[gameVersion] = index;
        return map;
    }, {});

    inputVersions.sort((a, b) => {
        const left = Object.prototype.hasOwnProperty.call(indices, a) ? indices[a] : Number.MAX_SAFE_INTEGER;
        const right = Object.prototype.hasOwnProperty.call(indices, b) ? indices[b] : Number.MAX_SAFE_INTEGER;

        if(left !== right) {
            return left - right;
        }

        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    });

    const releaseVersions = inputVersions.filter((projVer) => allReleases.includes(projVer));

    const allReleasesGrouped = groupVersions(allReleases, false);
    const projectVersionsGrouped = groupVersions(releaseVersions, true);

    const releaseVersionsAsRanges = projectVersionsGrouped.map(({ major, minor }) => {
        if(minor.length === 1) {
            return createSingleVersion(formatVersion(major, minor[0]));
        }

        if(allReleasesGrouped.find((x) => x.major === major).minor.every((value, index) => value === minor[index])) {
            return createSingleVersion(`${major}.x`);
        }

        return createVersionRange(formatVersion(major, minor[0]), formatVersion(major, minor[minor.length - 1]));
    });

    const legacyVersionsAsRanges = groupConsecutiveIndices(
        inputVersions.filter((projVer) => allLegacy.includes(projVer)),
        allLegacy
    );

    const output = [...releaseVersionsAsRanges, ...legacyVersionsAsRanges];

    return output;
}

export default function VersionDisplay({ gameVersions, allGameVersions = defaultGameVersions }) {
    const t = useTranslations("ProjectPage.versions");
    const formattedVersions = useMemo(() => {
        if(!Array.isArray(gameVersions) || gameVersions.length === 0) {
            return [];
        }

        return formatVersionsForDisplay(gameVersions, allGameVersions);
    }, [gameVersions, allGameVersions]);

    return (
        <>
            {formattedVersions.length > 0 ? (
                formattedVersions.map((version, index) => (
                    version.type === "range" ? (
                        <span key={index} className="version__game-versions-range">
                            <span className="version__game-versions">{version.start}</span>
                            <span className="version__game-versions-separator" aria-hidden="true">—</span>
                            <span className="version__game-versions">{version.end}</span>
                        </span>
                    ) : (
                        <span key={index} className="version__game-versions">
                            {version.label}
                        </span>
                    )
                ))
            ) : (
                <span className="version__game-versions">{t("notSpecified")}</span>
            )}
        </>
    );
}