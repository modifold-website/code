"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const isValidDateValue = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const formatDateValue = (date) => {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const getMonthStart = (value) => {
	const baseDate = isValidDateValue(value) ? new Date(`${value}T00:00:00`) : new Date();
	return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
};

const getCalendarDays = (monthDate) => {
	const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
	const firstWeekday = (firstDay.getDay() + 6) % 7;
	const startDate = new Date(firstDay);
	startDate.setDate(firstDay.getDate() - firstWeekday);

	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(startDate);
		date.setDate(startDate.getDate() + index);

		return date;
	});
};

export default function DatePopover({ id, label, value, onChange, locale, labels }) {
	const [isOpen, setIsOpen] = useState(false);
	const [monthDate, setMonthDate] = useState(() => getMonthStart(value));
	const wrapperRef = useRef(null);
	const selectedValue = isValidDateValue(value) ? value : "";
	const todayValue = formatDateValue(new Date());
	const monthLabel = useMemo(() => monthDate.toLocaleDateString(locale, { month: "long", year: "numeric" }), [monthDate, locale]);
	const weekdayLabels = useMemo(() => {
		const monday = new Date(2024, 0, 1);
		return Array.from({ length: 7 }, (_, index) => {
			const date = new Date(monday);
			date.setDate(monday.getDate() + index);
			return date.toLocaleDateString(locale, { weekday: "short" }).replace(".", "");
		});
	}, [locale]);
	const calendarDays = useMemo(() => getCalendarDays(monthDate), [monthDate]);
	const displayValue = selectedValue ? new Date(`${selectedValue}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" }) : labels.placeholder;

	useEffect(() => {
		setMonthDate(getMonthStart(value));
	}, [value]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if(wrapperRef.current && !wrapperRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const goToPreviousMonth = () => {
		setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
	};

	const goToNextMonth = () => {
		setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
	};

	const handleSelectDate = (date) => {
		onChange(formatDateValue(date));
		setIsOpen(false);
	};

	const handleClear = () => {
		onChange("");
		setIsOpen(false);
	};

	const handleToday = () => {
		const today = new Date();
		onChange(formatDateValue(today));
		setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
		setIsOpen(false);
	};

	return (
		<div className="field field--default date-popover" ref={wrapperRef}>
			<button id={id} type="button" className="button button--size-m button--type-secondary date-popover__trigger" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
				<span className="date-popover__label">{label}</span>

				<span className="date-popover__value">{displayValue}</span>
				
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<path d="M8 2v4"></path>
					<path d="M16 2v4"></path>
					<rect width="18" height="18" x="3" y="4" rx="2"></rect>
					<path d="M3 10h18"></path>
				</svg>
			</button>

			{isOpen ? (
				<div className="popover date-popover__panel">
					<div className="date-popover__header">
						<strong>{monthLabel}</strong>

						<div className="date-popover__nav">
							<button type="button" onClick={goToPreviousMonth} aria-label={labels.previousMonth}>
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="m15 18-6-6 6-6"></path>
								</svg>
							</button>

							<button type="button" onClick={goToNextMonth} aria-label={labels.nextMonth}>
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="m9 18 6-6-6-6"></path>
								</svg>
							</button>
						</div>
					</div>

					<div className="date-popover__weekdays">
						{weekdayLabels.map((weekday) => (
							<span key={weekday}>{weekday}</span>
						))}
					</div>

					<div className="date-popover__grid">
						{calendarDays.map((date) => {
							const dateValue = formatDateValue(date);
							const isOutsideMonth = date.getMonth() !== monthDate.getMonth();
							const isSelected = dateValue === selectedValue;
							const isToday = dateValue === todayValue;

							return (
								<button key={dateValue} type="button" className={`date-popover__day ${isOutsideMonth ? "date-popover__day--muted" : ""} ${isSelected ? "date-popover__day--selected" : ""} ${isToday ? "date-popover__day--today" : ""}`} onClick={() => handleSelectDate(date)}>
									{date.getDate()}
								</button>
							);
						})}
					</div>

					<div className="date-popover__footer">
						<button type="button" onClick={handleClear} className="button button--size-m button--type-minimal button--active-transform">
							{labels.clear}
						</button>

						<button type="button" onClick={handleToday} className="button button--size-m button--type-minimal button--active-transform">
							{labels.today}
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}