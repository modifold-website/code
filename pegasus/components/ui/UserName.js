import ProfileBadgeIcon from "./ProfileBadgeIcon";
import { getProfileBadgeCode } from "@/utils/profileBadges";

export default function UserName({ user, className = "", showVerifiedIcon = true }) {
    if(!user) {
        return null;
    }

    const profileBadgeCode = getProfileBadgeCode(user);

    return (
        <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span>{user.username}</span>

            {profileBadgeCode && showVerifiedIcon && (
                <ProfileBadgeIcon badge={profileBadgeCode} alt="" style={{ width: "18px", display: "inline-block" }} />
            )}
        </span>
    );
}