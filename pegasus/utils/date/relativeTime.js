export const formatRelativeTime = (value, locale, relativeTo = new Date()) => {
	const date = new Date(value);
	if(Number.isNaN(date.getTime())) {
		return "";
	}

	const formatter = new Intl.RelativeTimeFormat(locale || undefined, { numeric: "auto" });
	const seconds = Math.round((date.getTime() - relativeTo.getTime()) / 1000);
	const units = [
		["year", 60 * 60 * 24 * 365],
		["month", 60 * 60 * 24 * 30],
		["day", 60 * 60 * 24],
		["hour", 60 * 60],
		["minute", 60],
	];

	for(const [unit, secondsPerUnit] of units) {
		if(Math.abs(seconds) >= secondsPerUnit) {
			return formatter.format(Math.round(seconds / secondsPerUnit), unit);
		}
	}

	return formatter.format(seconds, "second");
};