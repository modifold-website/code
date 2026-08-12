const DISCLOSURE_ICONS = {
	ai: {
		className: "lucide-sparkles-icon lucide-sparkles",
		paths: <><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5a2 2 0 0 0 1.437 1.437l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0Z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></>,
	},
	advertising: {
		className: "lucide-megaphone-icon lucide-megaphone",
		paths: <><path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.8 13 21H7l-1.8-6.4"/><path d="M21 12H3"/></>,
	},
	paid: {
		className: "lucide-circle-dollar-sign-icon lucide-circle-dollar-sign",
		paths: <><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></>,
	},
	telemetry: {
		className: "lucide-radio-tower-icon lucide-radio-tower",
		paths: <><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2a6 6 0 0 1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></>,
	},
	photosensitivity: {
		className: "lucide-eye-icon lucide-eye",
		paths: <><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></>,
	},
	external: {
		className: "lucide-external-link-icon lucide-external-link",
		paths: <><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>,
	},
	archive: {
		className: "lucide-archive-icon lucide-archive",
		paths: <><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></>,
	},
};

export default function DisclosureIcon({ type }) {
	const icon = DISCLOSURE_ICONS[type];

	if(!icon) {
		return null;
	}

	return (
		<svg className={`disclosure-icon lucide ${icon.className}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ fill: "none" }} aria-hidden="true">
			{icon.paths}
		</svg>
	);
}