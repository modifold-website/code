export default function UserName({ user, className = "", showVerifiedIcon = true }) {
    if(!user) {
        return null;
    }

    const isVerified = user.isVerified === 1;

    return (
        <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span>{user.username}</span>

            {isVerified && showVerifiedIcon && (
                <img src="/badges/creator.webp" alt="Verified" style={{ width: "18px", display: "inline-block" }} />
            )}
        </span>
    );
}