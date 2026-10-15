export const displayNumber = (value, locale) => value === null || value === undefined ? "—" : new Intl.NumberFormat(locale).format(value);

export function displayDate(value, locale, omitCurrentYear = false) {
	if(!value) {
		return "—";
	}

	const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
	const format = omitCurrentYear && date.getUTCFullYear() === new Date().getUTCFullYear() ? { day: "numeric", month: "short" } : { dateStyle: "medium" };
	return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { ...format, timeZone: "UTC" }).format(date) : "—";
}

export function defaultDateRange() {
	const to = new Date();
	const from = new Date(to);
	from.setMonth(from.getMonth() - 1);
	const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	return { from: format(from), to: format(to) };
}