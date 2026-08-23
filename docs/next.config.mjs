/** @type {import('next').NextConfig} */
const nextConfig = {
    devIndicators: false,
    pageExtensions: ['js', 'jsx', 'md', 'mdx'],
	async redirects() {
		return [
			{
				source: '/api/v2/:path*',
				destination: '/api-v2/:path*',
				permanent: true,
			},
		];
	},
};

export default nextConfig;