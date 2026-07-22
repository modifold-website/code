import BrowseTabs from "@/components/pages/browse/BrowseTabs";
//import BrowseBackground from "@/components/pages/browse/BrowseBackground";
//<BrowseBackground />

export default function DiscoverLayout({ children }) {
	return (
		<>
			<div className="layout">
				<BrowseTabs />

				{children}
			</div>
		</>
	);
}