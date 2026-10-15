const DAY = 86400000;
const formatDay = (date) => date.toISOString().slice(0, 10);
const shiftDay = (day, offset) => formatDay(new Date(Date.parse(`${day}T00:00:00Z`) + offset * DAY));
const isDay = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && formatDay(new Date(`${value}T00:00:00Z`)) === value;
const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

const getAnalyticsPeriod = (query, now = new Date()) => {
	const today = formatDay(now);
	const from = query.from || shiftDay(today, -29);
	const to = query.to || today;
	if(!isDay(from) || !isDay(to)) {
		throw badRequest("invalid_dates");
	}

	const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
	if(days < 1 || days > 366 || shiftDay(from, -days) < "1970-01-01") {
		throw badRequest("invalid_dates");
	}

	return { from, to, previousFrom: shiftDay(from, -days), previousTo: shiftDay(from, -1), days };
};

const daySeries = (from, to) => {
	const result = [];
	for(let day = from; day <= to; day = shiftDay(day, 1)) {
		result.push(day);
	}
	
	return result;
};

module.exports = { getAnalyticsPeriod, daySeries, shiftDay, badRequest };