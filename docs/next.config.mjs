/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        viewTransition: true,
    },
    devIndicators: false,
    pageExtensions: ['js', 'jsx', 'md', 'mdx'],
};

export default nextConfig;