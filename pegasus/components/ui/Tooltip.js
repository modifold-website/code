"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 8;
const CLOSE_DELAY = 80;
const SKIP_DELAY = 300;
const TooltipContext = createContext(null);

export function TooltipProvider({ children }) {
	const [tooltip, setTooltip] = useState(null);
	const activeRef = useRef(null);
	const closeTimeoutRef = useRef(null);
	const warmUntilRef = useRef(0);

	const publish = useCallback((next) => {
		activeRef.current = next;
		setTooltip(next);
	}, []);

	const show = useCallback((next) => {
		clearTimeout(closeTimeoutRef.current);
		publish({ ...next, open: true });
	}, [publish]);

	const hide = useCallback((id, immediate = false) => {
		if(activeRef.current?.id !== id || !activeRef.current.open) {
			return;
		}

		clearTimeout(closeTimeoutRef.current);
		const close = () => {
			if(activeRef.current?.id === id && activeRef.current.open) {
				warmUntilRef.current = Date.now() + SKIP_DELAY;
				publish({ ...activeRef.current, open: false });
				closeTimeoutRef.current = setTimeout(() => {
					if(activeRef.current?.id === id && !activeRef.current.open) {
						publish(null);
					}
				}, 100);
			}
		};

		if(immediate) {
			close();
		} else {
			closeTimeoutRef.current = setTimeout(close, CLOSE_DELAY);
		}
	}, [publish]);

	const remove = useCallback((id) => {
		if(activeRef.current?.id === id) {
			clearTimeout(closeTimeoutRef.current);
			publish(null);
		}
	}, [publish]);

	const update = useCallback((id, next) => {
		const active = activeRef.current;
		if(active?.id === id && (active.content !== next.content || active.position !== next.position)) {
			publish({ ...active, ...next });
		}
	}, [publish]);

	const isWarm = useCallback(() => Boolean(activeRef.current?.open || Date.now() < warmUntilRef.current), []);
	const controls = useMemo(() => ({ show, hide, remove, update, isWarm }), [show, hide, remove, update, isWarm]);

	useEffect(() => () => clearTimeout(closeTimeoutRef.current), []);

	return (
		<TooltipContext.Provider value={controls}>
			{children}

			<TooltipBubble tooltip={tooltip} onHide={hide} />
		</TooltipContext.Provider>
	);
}

function TooltipBubble({ tooltip, onHide }) {
	const [layout, setLayout] = useState(null);
	const bubbleRef = useRef(null);
	const surfaceRef = useRef(null);
	const previousSizeRef = useRef(null);
	const morphRef = useRef(null);

	const updatePosition = useCallback(() => {
		const bubble = bubbleRef.current;
		const trigger = tooltip?.trigger;
		if(!tooltip?.open || !bubble || !trigger?.isConnected) {
			return;
		}

		const rect = trigger.getBoundingClientRect();
		const width = bubble.offsetWidth;
		const height = bubble.offsetHeight;
		const center = rect.left + rect.width / 2;
		const left = Math.min(Math.max(center - width / 2, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING));
		const above = rect.top - TOOLTIP_GAP - VIEWPORT_PADDING;
		const below = window.innerHeight - rect.bottom - TOOLTIP_GAP - VIEWPORT_PADDING;
		let position = tooltip.position === "bottom" ? "bottom" : "top";
		if(position === "top" && above < height && below > above) {
			position = "bottom";
		} else if(position === "bottom" && below < height && above > below) {
			position = "top";
		}

		const top = Math.min(Math.max(position === "bottom" ? rect.bottom + TOOLTIP_GAP : rect.top - height - TOOLTIP_GAP, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING));
		const arrow = Math.min(Math.max(center - left, 14), Math.max(14, width - 14));
		const instant = tooltip.keyboard || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const previous = previousSizeRef.current;
		const isSwitch = previous && previous.id !== tooltip.id;

		if(instant) {
			morphRef.current?.cancel();
		}

		if(isSwitch && !instant && surfaceRef.current) {
			const transform = getComputedStyle(surfaceRef.current).transform;
			const scale = transform === "none" ? { a: 1, d: 1 } : new DOMMatrixReadOnly(transform);
			morphRef.current?.cancel();
			morphRef.current = surfaceRef.current.animate([
				{ transform: "scale(" + previous.width * scale.a / width + ", " + previous.height * scale.d / height + ")" },
				{ transform: "scale(1)" },
			], { duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
		}

		previousSizeRef.current = { id: tooltip.id, width, height };
		setLayout((current) => current?.left === left && current.top === top && current.position === position && current.arrow === arrow && current.instant === instant ? current : { left, top, position, arrow, instant, moving: Boolean(isSwitch && !instant) });
	}, [tooltip]);

	useLayoutEffect(() => {
		if(!tooltip?.open) {
			previousSizeRef.current = null;
			morphRef.current?.cancel();
			if(!tooltip) {
				setLayout(null);
			}

			return;
		}

		updatePosition();
		const observer = new ResizeObserver(updatePosition);
		observer.observe(bubbleRef.current);
		observer.observe(tooltip.trigger);
		window.addEventListener("resize", updatePosition);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updatePosition);
		};
	}, [tooltip, updatePosition]);

	useLayoutEffect(() => {
		if(!tooltip?.open) {
			return;
		}

		const target = tooltip.focusTarget || tooltip.trigger.querySelector("button, a, input, textarea, select, [tabindex]") || tooltip.trigger;
		const ids = new Set((target.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
		ids.add(tooltip.id);
		target.setAttribute("aria-describedby", [...ids].join(" "));
		
		return () => {
			const remaining = (target.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== tooltip.id);
			if(remaining.length) {
				target.setAttribute("aria-describedby", remaining.join(" "));
			} else {
				target.removeAttribute("aria-describedby");
			}
		};
	}, [tooltip?.id, tooltip?.open, tooltip?.trigger, tooltip?.focusTarget]);

	useEffect(() => {
		if(!tooltip?.open) {
			return;
		}

		const hide = () => onHide(tooltip.id, true);
		const handleKeyDown = (event) => {
			if(event.key === "Escape") {
				hide();
			}
		};
		window.addEventListener("scroll", hide, true);
		window.addEventListener("blur", hide);
		document.addEventListener("keydown", handleKeyDown);
		
		return () => {
			window.removeEventListener("scroll", hide, true);
			window.removeEventListener("blur", hide);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [tooltip?.id, tooltip?.open, onHide]);

	useEffect(() => () => morphRef.current?.cancel(), []);

	if(!tooltip) {
		return null;
	}

	return createPortal(
		<span className={"mf-tooltip__positioner" + (layout?.moving ? " mf-tooltip__positioner--moving" : "") + (layout?.instant ? " mf-tooltip__positioner--instant" : "")} style={layout ? { transform: "translate3d(" + layout.left + "px, " + layout.top + "px, 0)", "--tooltip-arrow-x": layout.arrow + "px" } : undefined}>
			<span ref={bubbleRef} id={tooltip.id} role="tooltip" aria-hidden={!tooltip.open} data-position={layout?.position || tooltip.position} className={"mf-tooltip__bubble" + (tooltip.open && layout ? " mf-tooltip__bubble--visible" : "")}>
				<span ref={surfaceRef} className="mf-tooltip__surface" aria-hidden="true" />
				
				<span className="mf-tooltip__content">{tooltip.content}</span>
			</span>
		</span>,
		document.body
	);
}

export default function Tooltip({ content, children, position = "top", delay = 500 }) {
	const controls = useContext(TooltipContext);
	const id = useId();
	const triggerRef = useRef(null);
	const timeoutRef = useRef(null);
	const contentRef = useRef({ content, position });

	const clearShowTimeout = useCallback(() => {
		clearTimeout(timeoutRef.current);
		timeoutRef.current = null;
	}, []);

	useLayoutEffect(() => {
		contentRef.current = { content, position };
		if(!content) {
			clearShowTimeout();
			controls?.remove(id);
		} else {
			controls?.update(id, { content, position });
		}
	}, [content, position, controls, id, clearShowTimeout]);

	useEffect(() => () => {
		clearShowTimeout();
		controls?.remove(id);
	}, [controls, id, clearShowTimeout]);

	const scheduleShow = (keyboard = false, focusTarget = null) => {
		clearShowTimeout();
		if(!controls || !contentRef.current.content) {
			return;
		}

		const show = () => {
			timeoutRef.current = null;
			if(triggerRef.current?.isConnected) {
				controls.show({ id, trigger: triggerRef.current, ...contentRef.current, keyboard, focusTarget });
			}
		};

		const wait = keyboard || controls.isWarm() ? 0 : Math.max(0, delay);
		if(wait === 0) {
			show();
		} else {
			timeoutRef.current = setTimeout(show, wait);
		}
	};

	const hide = (immediate = false) => {
		clearShowTimeout();
		controls?.hide(id, immediate);
	};

	if(!content) {
		return children;
	}

	return (
		<span ref={triggerRef} className="mf-tooltip" data-position={position} onPointerEnter={(event) => {
			if(event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
				scheduleShow();
			}
		}} onPointerLeave={() => {
			if(!triggerRef.current?.contains(document.activeElement) || !document.activeElement?.matches(":focus-visible")) {
				hide();
			}
		}} onPointerDown={() => hide(true)} onFocus={(event) => {
			if(event.target.matches(":focus-visible")) {
				scheduleShow(true, event.target);
			}
		}} onBlur={(event) => {
			if(!event.currentTarget.contains(event.relatedTarget)) {
				hide(true);
			}
		}}>
			{children}
		</span>
	);
}