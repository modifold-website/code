import TwoFactorClient from "./TwoFactorClient";

export const metadata = {
    robots: {
        index: false,
        follow: false,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};

export default function TwoFactorPage() {
    return <TwoFactorClient />;
}