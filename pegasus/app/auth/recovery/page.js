import PasswordRecoveryPage from "@/components/auth/PasswordRecoveryPage";

export const metadata = {
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};

export default function RecoveryPage() {
	return <PasswordRecoveryPage />;
}