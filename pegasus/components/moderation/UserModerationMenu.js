"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export default function UserModerationMenu({ label, children, options, value, disabled = false, stretch = false }) {
	const [open, setOpen] = useState(false);
	const [above, setAbove] = useState(false);
	const wrapperRef = useRef(null);
	const triggerRef = useRef(null);
	const panelRef = useRef(null);
	const id = useId();

	const close = (restoreFocus = false) => {
		setOpen(false);
		if(restoreFocus) {
			triggerRef.current?.focus();
		}
	};

	useLayoutEffect(() => {
		if(!open) {
			return;
		}

		const updatePosition = () => {
			const rect = triggerRef.current.getBoundingClientRect();
			const height = panelRef.current.offsetHeight;
			setAbove(window.innerHeight - rect.bottom < height + 20 && rect.top > height + 20);
		};

		updatePosition();

		const selected = panelRef.current.querySelector('[aria-checked="true"]') || panelRef.current.querySelector("button");
		selected?.focus();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);

		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [open]);

	useEffect(() => {
		if(!open) {
			return;
		}

		const outside = (event) => {
			if(!wrapperRef.current?.contains(event.target)) {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", outside);

		return () => document.removeEventListener("pointerdown", outside);
	}, [open]);

	const handleKeyDown = (event) => {
		if(event.key === "Escape" && open) {
			event.preventDefault();
			event.stopPropagation();
			close(true);
		} else if(event.key === "Tab" && open) {
			close(true);
		} else if(["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
			event.preventDefault();

			if(!open) {
				return setOpen(true);
			}

			const items = [...panelRef.current.querySelectorAll("button")];
			const current = items.indexOf(document.activeElement);
			const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;

			items[next]?.focus();
		}
	};

	return (
		<div ref={wrapperRef} className={`user-moderation-menu${stretch ? " user-moderation-menu--stretch" : ""}`} onKeyDown={handleKeyDown}>
			<button ref={triggerRef} type="button" className={stretch ? "user-moderation-menu__select field field--default" : "icon-button user-moderation-menu__trigger"} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled} onClick={() => setOpen((current) => !current)}>
				{children}
			</button>

			{open && (
				<div ref={panelRef} id={id} role="menu" aria-label={label} className={`popover user-moderation-menu__panel${above ? " user-moderation-menu__panel--above" : ""}`}>
					<div className="context-list">
						{options.map((option) => (
							<button
								key={option.value}
								type="button"
								role={value === undefined ? "menuitem" : "menuitemradio"}
								aria-checked={value === undefined ? undefined : value === option.value}
								tabIndex={-1}
								className={`context-list-option${value === option.value ? " context-list-option--selected" : ""}`}
								onClick={() => {
									close(true);
									option.onSelect();
								}}
							>
								<span className="context-list-option__label">{option.label}</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}