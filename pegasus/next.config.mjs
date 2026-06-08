import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "./i18n/routing.js";

const withNextIntl = createNextIntlPlugin(routing);
const publicApiBase = process.env.STAGING === 'true' ? 'https://staging-api.modifold.com' : (process.env.NEXT_PUBLIC_API_BASE || process.env.PUBLIC_API_BASE || 'https://api.modifold.com');

const nextConfig = {
    allowedDevOrigins: ['staging.modifold.com'],
    output: 'standalone',
    devIndicators: false,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
        minimumCacheTTL: 2678400,
    },
    env: {
        NEXT_PUBLIC_API_BASE: publicApiBase
    }
};

export default withNextIntl(nextConfig);
