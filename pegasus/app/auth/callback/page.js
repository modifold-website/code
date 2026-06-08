import AuthCallbackClient from "./AuthCallbackClient";

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

export default function AuthCallbackPage() {
    return <AuthCallbackClient />;
}