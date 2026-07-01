import { getProfileBadge } from "@/utils/profileBadges";

export default function ProfileBadgeIcon({ badge, className = "", alt = "", ...props }) {
	const profileBadge = getProfileBadge(badge);

	if(!profileBadge) {
		return null;
	}

	return (
		<img className={className} src={profileBadge.icon} alt={alt} {...props} />
	);
}