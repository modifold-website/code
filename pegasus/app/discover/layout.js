import BrowseTabs from "@/components/pages/browse/BrowseTabs";
import BrowseBackground from "@/components/pages/browse/BrowseBackground";

export default function DiscoverLayout({ children }) {
	return (
		<>
			<BrowseBackground />

			<div className="layout">
				<BrowseTabs />

				{children}
			</div>
		</>
	);
}