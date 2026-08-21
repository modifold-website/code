"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ConfirmModal from "@/modal/ConfirmModal";

export default function UnsavedChangesBar({ isDirty, onSave, onReset, isSaving = false, message = "You have unsaved changes.", resetLabel = "Reset", saveLabel = "Save" }) {
	const router = useRouter();
	const t = useTranslations("SettingsProjectPage.unsavedBar.leaveConfirm");
	const [transitionState, setTransitionState] = useState(isDirty ? "enter-from" : "hidden");
	const [pendingNavigation, setPendingNavigation] = useState(null);
	const bypassNavigationRef = useRef(false);

	useEffect(() => {
		if(!isDirty) {
			setPendingNavigation(null);
			bypassNavigationRef.current = false;
			return;
		}

		const handleBeforeUnload = (event) => {
			if(bypassNavigationRef.current) {
				return;
			}

			event.preventDefault();
			event.returnValue = "";
		};

		const handleDocumentClick = (event) => {
			if(event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}

			const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
			if(!target || target.hasAttribute("download") || (target.target && target.target !== "_self")) {
				return;
			}

			const url = new URL(target.href, window.location.href);
			if(!["http:", "https:"].includes(url.protocol)) {
				return;
			}

			const currentUrl = new URL(window.location.href);
			const isSameView = url.origin === currentUrl.origin && url.pathname === currentUrl.pathname && url.search === currentUrl.search;
			if(isSameView) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			setPendingNavigation({
				href: url.href,
				internalHref: url.origin === currentUrl.origin ? `${url.pathname}${url.search}${url.hash}` : null,
			});
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		document.addEventListener("click", handleDocumentClick, true);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			document.removeEventListener("click", handleDocumentClick, true);
		};
	}, [isDirty]);

	const handleLeavePage = () => {
		if(!pendingNavigation) {
			return;
		}

		bypassNavigationRef.current = true;
		if(pendingNavigation.internalHref) {
			router.push(pendingNavigation.internalHref, { scroll: false });
			return;
		}

		window.location.assign(pendingNavigation.href);
	};

	useEffect(() => {
		if(isDirty) {
			setTransitionState((currentState) => {
				if(currentState === "hidden") {
					return "enter-from";
				}

				if(currentState === "leaving" || currentState === "leave-to") {
					return "entering";
				}

				return currentState;
			});
			return;
		}

		setTransitionState((currentState) => currentState === "hidden" ? currentState : "leaving");
	}, [isDirty]);

	useEffect(() => {
		if(transitionState === "enter-from") {
			let nextFrame;
			const initialFrame = window.requestAnimationFrame(() => {
				nextFrame = window.requestAnimationFrame(() => setTransitionState("entering"));
			});

			return () => {
				window.cancelAnimationFrame(initialFrame);
				if(nextFrame) {
					window.cancelAnimationFrame(nextFrame);
				}
			};
		}

		if(transitionState === "leaving") {
			const frame = window.requestAnimationFrame(() => setTransitionState("leave-to"));
			return () => window.cancelAnimationFrame(frame);
		}
	}, [transitionState]);

	const transitionClasses = ["unsaved-changes-bar"];

	if(transitionState === "enter-from" || transitionState === "entering") {
		transitionClasses.push("unsaved-changes-bar-enter-active");
	}

	if(transitionState === "enter-from") {
		transitionClasses.push("unsaved-changes-bar-enter-from");
	}

	if(transitionState === "leaving" || transitionState === "leave-to") {
		transitionClasses.push("unsaved-changes-bar-leave-active");
	}

	if(transitionState === "leave-to") {
		transitionClasses.push("unsaved-changes-bar-leave-to");
	}

	const handleTransitionEnd = (event) => {
		if(event.target !== event.currentTarget || event.propertyName !== "opacity") {
			return;
		}

		if(transitionState === "entering") {
			setTransitionState("visible");
		}

		if(transitionState === "leave-to" && !isDirty) {
			setTransitionState("hidden");
		}
	};

	return (
		<>
			{transitionState !== "hidden" ? (
				<>
					<div aria-hidden="true" className="unsaved-changes-bar__spacer"></div>

					<div className="unsaved-changes-bar__wrap" role="status" aria-live="polite">
						<div className={transitionClasses.join(" ")} onTransitionEnd={handleTransitionEnd}>
							<p className="unsaved-changes-bar__message">{message}</p>

							<div className="unsaved-changes-bar__actions">
								<button type="button" className="button button--size-m button--type-minimal" onClick={onReset} disabled={isSaving}>
									{resetLabel}
								</button>

								<button type="button" className="button button--size-m button--type-primary" onClick={onSave} disabled={isSaving}>
									{isSaving ? `${saveLabel}...` : saveLabel}
								</button>
							</div>
						</div>
					</div>
				</>
			) : null}

			<ConfirmModal
				isOpen={Boolean(pendingNavigation)}
				title={t("title")}
				messageTitle={t("messageTitle")}
				description={t("description")}
				cancelLabel={t("stay")}
				confirmLabel={t("leave")}
				onRequestClose={() => setPendingNavigation(null)}
				onConfirm={handleLeavePage}
			/>
		</>
	);
}