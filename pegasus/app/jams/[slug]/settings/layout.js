import { serverApiFetch } from "@/utils/api/server";
import { cookies } from "next/headers";
import { notFound, forbidden } from "next/navigation";
import ModJamSettingsSidebar from "@/components/mod-jams/settings/ModJamSettingsSidebar";

const serverApiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

async function getJam(slug, authToken) {
	const response = await serverApiFetch(`${serverApiBase}/mod-jams/${slug}`, {
		headers: { Authorization: `Bearer ${authToken}` },
		cache: "no-store",
	});

	if(!response.ok) {
		return null;
	}

	return response.json();
}

export default async function ModJamSettingsLayout({ children, params }) {
	const { slug } = await params;
	const cookieStore = await cookies();
	const authToken = cookieStore.get("authToken")?.value;

	if(!authToken) {
		forbidden();
	}

	const data = await getJam(slug, authToken);
	if(!data?.mod_jam) {
		notFound();
	}

	if(!data.permissions?.can_edit) {
		forbidden();
	}

	return (
		<div className="layout">
			<div className="page-content settings-page">
				<ModJamSettingsSidebar jam={data.mod_jam} />
				
				{children}
			</div>
		</div>
	);
}