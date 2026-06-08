const fs = require("fs");
const path = require("path");

const loadFontDataUri = (fileName) => {
	try {
		const fontPath = path.join(__dirname, "..", "assets", fileName);
		const fontBuffer = fs.readFileSync(fontPath);
		return `data:font/ttf;base64,${fontBuffer.toString("base64")}`;
	} catch (error) {
		console.warn(`[analyticsEmbedImage] Failed to load font ${fileName}:`, error.message);
		return null;
	}
};

const interRegularDataUri = loadFontDataUri("Inter_28pt-Regular.ttf");
const interMediumDataUri = loadFontDataUri("Inter_28pt-Medium.ttf");
const interBoldDataUri = loadFontDataUri("Inter_28pt-Bold.ttf");

const buildFontFaceCss = () => {
	const chunks = [];

	if(interRegularDataUri) {
		chunks.push(`
			@font-face {
				font-family: 'Inter Embed';
				font-style: normal;
				font-weight: 400;
				src: url('${interRegularDataUri}') format('truetype');
			}
		`);
	}

	if(interMediumDataUri) {
		chunks.push(`
			@font-face {
				font-family: 'Inter Embed';
				font-style: normal;
				font-weight: 500;
				src: url('${interMediumDataUri}') format('truetype');
			}
		`);
	}

	if(interBoldDataUri) {
		chunks.push(`
			@font-face {
				font-family: 'Inter Embed';
				font-style: normal;
				font-weight: 700;
				src: url('${interBoldDataUri}') format('truetype');
			}
		`);
	}

	return chunks.join("\n");
};

const embeddedFontsCss = buildFontFaceCss();

const normalizeEmbedTheme = (value) => {
	const normalized = String(value || "light").trim().toLowerCase();
	if(normalized === "dark") {
		return "dark";
	}

	if(normalized === "white" || normalized === "light") {
		return "light";
	}

	return "light";
};

const escapeXml = (value) => String(value ?? "")
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/"/g, "&quot;")
	.replace(/'/g, "&#39;");

const formatUtcLabel = (value) => {
	const parsed = new Date(value);
	if(Number.isNaN(parsed.getTime())) {
		return "";
	}

	const formatter = new Intl.DateTimeFormat("en-US", {
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		hour12: true,
		timeZone: "UTC",
	});

	return formatter.format(parsed).replace(",", " @") + " UTC";
};

const toDateValue = (value) => {
	if(!value) {
		return null;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getNiceStep = (value) => {
	const safe = Math.max(1, Number(value) || 0);
	const magnitude = 10 ** Math.floor(Math.log10(safe));
	const normalized = safe / magnitude;

	if(normalized <= 1) return 1 * magnitude;
	if(normalized <= 2) return 2 * magnitude;
	if(normalized <= 2.5) return 2.5 * magnitude;
	if(normalized <= 5) return 5 * magnitude;
	return 10 * magnitude;
};

const getNiceChartMax = (maxValue, rowsCount) => {
	const safeMaxValue = Math.max(10, Math.ceil(Number(maxValue) || 0));
	const safeRowsCount = Math.max(2, Math.floor(Number(rowsCount) || 0));
	const segmentsCount = safeRowsCount - 1;
	const rawStep = safeMaxValue / segmentsCount;
	const niceStep = getNiceStep(rawStep);

	return niceStep * segmentsCount;
};

const buildEmbedSvg = ({ projectTitle, theme, points, playersOnlineNow, activeServersNow }) => {
	const palette = theme === "dark" ? {
		page: "#161617",
		card: "#232324",
		statBg: "#161617",
		chartCard: "#232324",
		chartBg: "#232324",
		text: "#eeeeee",
		textMuted: "#969c9d",
		grid: "#484848",
		servers: "#f45060",
		players: "#14ae5c",
		serversFill: "rgba(244,80,96,0.10)",
		playersFill: "rgba(20,174,92,0.12)",
	} : {
		page: "#f5f5f5",
		card: "#ffffff",
		statBg: "#f5f5f5",
		chartCard: "#ffffff",
		chartBg: "#ffffff",
		text: "#000000",
		textMuted: "#595959",
		grid: "#d7d8db",
		servers: "#f45060",
		players: "#14ae5c",
		serversFill: "rgba(244,80,96,0.10)",
		playersFill: "rgba(20,174,92,0.12)",
	};

	const width = 1200;
	const height = 543;
	const chartFrameX = 80;
	const chartFrameY = 226;
	const chartFrameW = 1038;
	const chartFrameH = 154;
	const chartPaddingLeft = 24;
	const chartPaddingRight = 10;
	const chartPaddingTop = 14;
	const chartX = chartFrameX + chartPaddingLeft;
	const chartY = chartFrameY + chartPaddingTop;
	const chartW = chartFrameW - chartPaddingLeft - chartPaddingRight;
	const chartH = 160;
	const rowsCount = 5;
	const filteredPoints = (Array.isArray(points) ? points : []).filter((point) => toDateValue(point?.day));
	const usablePoints = filteredPoints.length > 0 ? filteredPoints : [{
		day: new Date().toISOString(),
		players: 0,
		servers: 0,
	}];
	const maxMetric = Math.max(...usablePoints.flatMap((point) => [Number(point.players) || 0, Number(point.servers) || 0]));
	const yMax = getNiceChartMax(maxMetric, rowsCount);
	const xDenominator = Math.max(usablePoints.length - 1, 1);

	const chartPoints = usablePoints.map((point, index) => {
		const x = chartX + (index / xDenominator) * chartW;
		const serverY = chartY + chartH - ((Math.max(0, Number(point.servers) || 0) / yMax) * chartH);
		const playerY = chartY + chartH - ((Math.max(0, Number(point.players) || 0) / yMax) * chartH);
		return {
			x,
			serverY,
			playerY,
		};
	});

	const toPath = (key) => chartPoints.map((point, index) => {
		const y = key === "servers" ? point.serverY : point.playerY;
		return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${y.toFixed(2)}`;
	}).join(" ");

	const toAreaPath = (key) => {
		const linePath = toPath(key);
		const firstX = chartPoints[0].x.toFixed(2);
		const lastX = chartPoints[chartPoints.length - 1].x.toFixed(2);
		const baseline = (chartY + chartH).toFixed(2);
		return `${linePath} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
	};

	const yTicks = Array.from({ length: rowsCount }, (_, index) => {
		const value = Math.round((yMax / (rowsCount - 1)) * (rowsCount - 1 - index));
		const y = chartY + ((chartH / (rowsCount - 1)) * index);
		return { value, y };
	});

	const firstDateLabel = formatUtcLabel(usablePoints[0].day);
	const lastDateLabel = formatUtcLabel(usablePoints[usablePoints.length - 1].day);
	const serversPeak = usablePoints.reduce((max, point) => Math.max(max, Number(point.servers) || 0), 0);
	const playersPeak = usablePoints.reduce((max, point) => Math.max(max, Number(point.players) || 0), 0);
	const safeTitle = escapeXml(projectTitle || "Project");

	const gridLines = yTicks.map((tick) => `
		<line x1="${chartX}" y1="${tick.y}" x2="${chartX + chartW}" y2="${tick.y}" stroke="${palette.grid}" stroke-width="1" stroke-dasharray="6 8" />
	`).join("");

	const yLabels = yTicks.map((tick) => `
			<text class="embed-font" x="${chartX - 14}" y="${tick.y + 6}" fill="${palette.textMuted}" font-size="16" text-anchor="end">${tick.value}</text>
	`).join("");

	return `
		<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
			<style>
				${embeddedFontsCss}
				.embed-font {
					font-family: 'Inter Embed', Inter, Segoe UI, Arial, sans-serif;
				}
				.logotype {
					cursor: pointer;
				}
				.logotype:hover {
					opacity: 0.8;
				}
			</style>

			<rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="${palette.page}" />
			<rect x="24" y="24" width="${width - 48}" height="128" rx="22" fill="${palette.card}" />
			<rect x="24" y="170" width="${width - 48}" height="280" rx="22" fill="${palette.chartCard}" />

			<text class="embed-font" x="52" y="64" fill="${palette.text}" font-size="22" font-weight="600">${safeTitle}</text>
			<text class="embed-font" x="52" y="96" fill="${palette.textMuted}" font-size="18">Analytics • Last 30 days (UTC)</text>
			<text class="embed-font" x="52" y="131" fill="${palette.textMuted}" font-size="18">Players peak ${playersPeak} • Servers peak ${serversPeak}</text>

			<rect x="736" y="46" width="200" height="84" rx="20" fill="${palette.statBg}" />
			<text class="embed-font" x="760" y="75" fill="${palette.textMuted}" font-size="16">Active servers</text>
			<text class="embed-font" x="760" y="114" fill="${palette.text}" font-size="30" font-weight="700">${activeServersNow}</text>

			<rect x="952" y="46" width="200" height="84" rx="20" fill="${palette.statBg}" />
			<text class="embed-font" x="976" y="75" fill="${palette.textMuted}" font-size="16">Online now</text>
			<text class="embed-font" x="976" y="114" fill="${palette.text}" font-size="30" font-weight="700">${playersOnlineNow}</text>

			<text class="embed-font" x="52" y="208" fill="${palette.text}" font-size="20" font-weight="700">Servers and players online</text>
			<rect x="${chartFrameX}" y="${chartFrameY}" width="${chartFrameW}" height="${chartFrameH}" rx="12" fill="${palette.chartBg}" />

			${gridLines}
			${yLabels}

			<path d="${toAreaPath("servers")}" fill="${palette.serversFill}" />
			<path d="${toAreaPath("players")}" fill="${palette.playersFill}" />
			<path d="${toPath("servers")}" stroke="${palette.servers}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
			<path d="${toPath("players")}" stroke="${palette.players}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />

			<circle cx="${chartPoints[chartPoints.length - 1].x.toFixed(2)}" cy="${chartPoints[chartPoints.length - 1].serverY.toFixed(2)}" r="4.5" fill="${palette.servers}" />
			<circle cx="${chartPoints[chartPoints.length - 1].x.toFixed(2)}" cy="${chartPoints[chartPoints.length - 1].playerY.toFixed(2)}" r="4.5" fill="${palette.players}" />

			<circle cx="500" cy="426" r="8" fill="${palette.players}" />
			<text class="embed-font" x="516" y="432" fill="${palette.players}" font-size="18">Players</text>
			<circle cx="620" cy="426" r="8" fill="${palette.servers}" />
			<text class="embed-font" x="636" y="432" fill="${palette.servers}" font-size="18">Servers</text>

			<text class="embed-font" x="${chartX}" y="430" fill="${palette.textMuted}" font-size="16">${escapeXml(firstDateLabel)}</text>
			<text class="embed-font" x="${chartX + chartW}" y="430" fill="${palette.textMuted}" font-size="16" text-anchor="end">${escapeXml(lastDateLabel)}</text>
		
			<a href="https://modifold.com" target="_blank" rel="noopener noreferrer" class="logotype">
				<svg x="520" y="477" width="149" height="34" viewBox="0 0 149 34" fill="none" xmlns="http://www.w3.org/2000/svg">
					<g clip-path="url(#clip0_7744_60)">
						<path d="M0 14.7152C0 2.59724 2.58734 0 14.6591 0H19.2113C31.2831 0 33.8705 2.59724 33.8705 14.7152V19.2848C33.8705 31.4027 31.2831 34 19.2113 34H14.6591C2.58734 34 0 31.4027 0 19.2848V14.7152Z" fill="url(#paint0_linear_7744_60)"/>
						<path d="M16.7746 3.71568C16.9261 3.62651 17.1135 3.62651 17.265 3.71568L28.5094 10.332C28.6587 10.4199 28.7506 10.5811 28.7506 10.7554V23.3169C28.7506 23.492 28.6579 23.6541 28.5074 23.7416L17.263 30.2856C17.1125 30.3731 16.9271 30.3731 16.7766 30.2856L5.5323 23.7416C5.3818 23.6541 5.28906 23.492 5.28906 23.3169V10.7554C5.28906 10.5811 5.38093 10.4199 5.53027 10.332L16.7746 3.71568ZM6.58534 11.2094V22.8644L17.0198 28.9561L27.4544 22.8644V11.2094L17.0198 5.04242L6.58534 11.2094ZM26.2554 11.8129V22.2987L17.0198 27.5982L7.78434 22.2987V11.8129L17.0198 6.4003L26.2554 11.8129ZM9.01228 21.6764L16.5334 26.014V17.4518L9.01228 13.1519V21.6764ZM17.6186 17.4644V25.9763L25.1023 21.6641V13.1142L17.6186 17.4644ZM15.7476 23.1097V24.4741L14.625 23.8264V22.4685L15.7476 23.1097ZM19.4894 23.8264L18.3669 24.4741V23.1097L19.4894 22.4685V23.8264ZM10.958 20.3941V21.7519L9.79808 21.1107V19.7529L10.958 20.3941ZM24.3165 21.1107L23.1565 21.7519V20.3941L24.3165 19.7529V21.1107ZM13.727 18.4327V20.9598L11.6316 19.7905V17.2634L13.727 18.4327ZM22.4829 19.7905L20.3875 20.9598V18.4327L22.4829 17.2634V19.7905ZM15.785 18.0932V19.5265L14.625 18.8853V17.452L15.785 18.0932ZM19.4894 18.8853L18.3295 19.5265V18.0932L19.4894 17.452V18.8853ZM10.958 15.4529V16.8108L9.79808 16.1695V14.8117L10.958 15.4529ZM24.3165 16.1695L23.1565 16.8108V15.4528L24.3165 14.8116V16.1695Z" fill="white"/>
						<path d="M48.756 10.16C50.6227 10.16 52.088 10.748 53.152 11.924C54.2347 13.0813 54.776 14.7147 54.776 16.824V25H52.396L51.724 22.704C51.3133 23.3947 50.7067 24.0013 49.904 24.524C49.1013 25.028 48.1493 25.28 47.048 25.28C46.0773 25.28 45.2 25.084 44.416 24.692C43.6507 24.3 43.0533 23.7493 42.624 23.04C42.1947 22.3307 41.98 21.528 41.98 20.632C41.98 19.2507 42.5213 18.1493 43.604 17.328C44.7053 16.488 46.3013 16.068 48.392 16.068H51.528C51.4533 15.0973 51.1547 14.332 50.632 13.772C50.128 13.1933 49.4467 12.904 48.588 12.904C47.8973 12.904 47.3 13.072 46.796 13.408C46.292 13.744 45.9187 14.1547 45.676 14.64L42.708 14.136C43.0627 12.904 43.7907 11.9333 44.892 11.224C46.012 10.5147 47.3 10.16 48.756 10.16ZM47.804 22.564C48.924 22.564 49.8293 22.2 50.52 21.472C51.2107 20.744 51.556 19.7827 51.556 18.588H48.504C46.32 18.588 45.228 19.2227 45.228 20.492C45.228 21.1267 45.4613 21.6307 45.928 22.004C46.3947 22.3773 47.02 22.564 47.804 22.564ZM56.8692 25V10.44H59.2772L59.9212 12.624C60.3879 11.8587 61.0039 11.2613 61.7692 10.832C62.5532 10.384 63.3932 10.16 64.2892 10.16C65.3346 10.16 66.2772 10.4213 67.1172 10.944C67.9572 11.4667 68.6199 12.1853 69.1052 13.1C69.5906 14.0147 69.8332 15.0507 69.8332 16.208V25H66.6132V16.572C66.6132 15.5267 66.3146 14.6773 65.7172 14.024C65.1199 13.3707 64.3546 13.044 63.4212 13.044C62.4506 13.044 61.6479 13.38 61.0132 14.052C60.3972 14.7053 60.0892 15.5453 60.0892 16.572V25H56.8692ZM77.8662 10.16C79.7328 10.16 81.1982 10.748 82.2622 11.924C83.3448 13.0813 83.8862 14.7147 83.8862 16.824V25H81.5062L80.8342 22.704C80.4235 23.3947 79.8168 24.0013 79.0142 24.524C78.2115 25.028 77.2595 25.28 76.1582 25.28C75.1875 25.28 74.3102 25.084 73.5262 24.692C72.7608 24.3 72.1635 23.7493 71.7342 23.04C71.3048 22.3307 71.0902 21.528 71.0902 20.632C71.0902 19.2507 71.6315 18.1493 72.7142 17.328C73.8155 16.488 75.4115 16.068 77.5022 16.068H80.6382C80.5635 15.0973 80.2648 14.332 79.7422 13.772C79.2382 13.1933 78.5568 12.904 77.6982 12.904C77.0075 12.904 76.4102 13.072 75.9062 13.408C75.4022 13.744 75.0288 14.1547 74.7862 14.64L71.8182 14.136C72.1728 12.904 72.9008 11.9333 74.0022 11.224C75.1222 10.5147 76.4102 10.16 77.8662 10.16ZM76.9142 22.564C78.0342 22.564 78.9395 22.2 79.6302 21.472C80.3208 20.744 80.6662 19.7827 80.6662 18.588H77.6142C75.4302 18.588 74.3382 19.2227 74.3382 20.492C74.3382 21.1267 74.5715 21.6307 75.0382 22.004C75.5048 22.3773 76.1302 22.564 76.9142 22.564ZM89.3394 25H86.1194V5.26H89.3394V25ZM102.076 10.44H105.352L99.3881 26.82C98.8841 28.2013 98.2308 29.2 97.4281 29.816C96.6441 30.432 95.5894 30.74 94.2641 30.74H92.0521L91.7721 27.8H94.4881C95.0294 27.8 95.4401 27.6787 95.7201 27.436C96.0188 27.212 96.2708 26.8107 96.4761 26.232L96.6441 25.784L90.1761 10.44H93.6201L97.9041 20.94H98.3521L102.076 10.44ZM115.293 22.2L115.013 25H112.297C110.71 25 109.506 24.6267 108.685 23.88C107.864 23.1147 107.453 22.0133 107.453 20.576V13.24H105.073V10.44H107.453L108.265 6.24H110.673V10.44H115.013V13.24H110.673V20.576C110.673 21.6587 111.214 22.2 112.297 22.2H115.293ZM119.784 25H116.564V10.44H119.784V25ZM118.188 8.368C117.591 8.368 117.105 8.19067 116.732 7.836C116.359 7.46267 116.172 6.98667 116.172 6.408C116.172 5.82933 116.359 5.35333 116.732 4.98C117.124 4.60667 117.609 4.42 118.188 4.42C118.767 4.42 119.243 4.60667 119.616 4.98C119.989 5.35333 120.176 5.82933 120.176 6.408C120.176 6.98667 119.989 7.46267 119.616 7.836C119.243 8.19067 118.767 8.368 118.188 8.368ZM128.909 25.28C127.453 25.28 126.146 24.9627 124.989 24.328C123.831 23.6747 122.926 22.7787 122.273 21.64C121.638 20.4827 121.321 19.176 121.321 17.72C121.321 16.264 121.638 14.9667 122.273 13.828C122.926 12.6707 123.831 11.7747 124.989 11.14C126.146 10.4867 127.453 10.16 128.909 10.16C130.514 10.16 131.933 10.5613 133.165 11.364C134.415 12.148 135.302 13.268 135.825 14.724L132.801 15.228C132.483 14.5933 131.989 14.08 131.317 13.688C130.663 13.296 129.926 13.1 129.105 13.1C127.798 13.1 126.734 13.5293 125.913 14.388C125.091 15.2467 124.681 16.3573 124.681 17.72C124.681 19.0827 125.091 20.1933 125.913 21.052C126.734 21.9107 127.798 22.34 129.105 22.34C129.963 22.34 130.729 22.144 131.401 21.752C132.073 21.3413 132.577 20.8093 132.913 20.156L135.937 20.66C135.414 22.1347 134.509 23.2733 133.221 24.076C131.933 24.8787 130.495 25.28 128.909 25.28ZM142.02 25.28C140.377 25.28 139.005 24.8973 137.904 24.132C136.821 23.348 136.121 22.2747 135.804 20.912L138.912 20.38C139.155 21.0707 139.565 21.6027 140.144 21.976C140.741 22.3493 141.451 22.536 142.272 22.536C142.981 22.536 143.579 22.4053 144.064 22.144C144.549 21.8827 144.792 21.4813 144.792 20.94C144.792 20.436 144.54 20.0533 144.036 19.792C143.532 19.512 142.757 19.232 141.712 18.952C140.667 18.6533 139.799 18.3547 139.108 18.056C138.417 17.7573 137.82 17.3187 137.316 16.74C136.831 16.1613 136.588 15.396 136.588 14.444C136.588 13.0627 137.12 12.008 138.184 11.28C139.248 10.5333 140.573 10.16 142.16 10.16C143.597 10.16 144.839 10.5333 145.884 11.28C146.929 12.008 147.657 13.016 148.068 14.304L145.072 14.808C144.811 14.192 144.428 13.7253 143.924 13.408C143.439 13.072 142.86 12.904 142.188 12.904C141.553 12.904 141.012 13.0347 140.564 13.296C140.135 13.5573 139.92 13.912 139.92 14.36C139.92 14.8827 140.181 15.2933 140.704 15.592C141.227 15.872 142.029 16.1613 143.112 16.46C144.12 16.74 144.96 17.0387 145.632 17.356C146.323 17.6547 146.901 18.0933 147.368 18.672C147.853 19.232 148.096 19.96 148.096 20.856C148.096 21.6773 147.872 22.424 147.424 23.096C146.976 23.7493 146.295 24.2813 145.38 24.692C144.484 25.084 143.364 25.28 142.02 25.28Z" fill="${palette.text}"/>
					</g>
					<defs>
						<linearGradient id="paint0_linear_7744_60" x1="-4.25509e-07" y1="1.60072e-06" x2="33.9997" y2="33.8702" gradientUnits="userSpaceOnUse">
							<stop stop-color="#68A5FF"/>
							<stop offset="0.5" stop-color="#307DF0"/>
							<stop offset="1" stop-color="#307DF0"/>
						</linearGradient>
							<clipPath id="clip0_7744_60">
							<rect width="149" height="34" fill="white"/>
						</clipPath>
					</defs>
				</svg>
			</a>
		</svg>
	`;
};

const renderProjectAnalyticsEmbedSvg = ({ projectTitle, theme, points, playersOnlineNow, activeServersNow }) => {
	return buildEmbedSvg({
		projectTitle,
		theme,
		points,
		playersOnlineNow: Math.max(0, Number(playersOnlineNow) || 0),
		activeServersNow: Math.max(0, Number(activeServersNow) || 0),
	});
};

module.exports = {
	normalizeEmbedTheme,
	renderProjectAnalyticsEmbedSvg,
};