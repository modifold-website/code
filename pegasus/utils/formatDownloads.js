export const normalizeDownloadCount = (value) => Math.max(0, Math.floor(Number(value) || 0));

export const formatExactDownloadCount = (value) => String(normalizeDownloadCount(value));

export const formatDownloads = (value, locale = "en-US") => {
	const count = normalizeDownloadCount(value);

	if(count < 10000) {
		return new Intl.NumberFormat(locale).format(count);
	}

	if(count < 1000000) {
		return new Intl.NumberFormat(locale, {
			notation: "compact",
			maximumFractionDigits: 1,
		}).format(count);
	}

	return new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 2,
	}).format(count);
};

export const formatCompactDownloadCount = formatDownloads;