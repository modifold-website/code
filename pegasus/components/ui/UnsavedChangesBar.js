"use client";

import { useEffect, useState } from "react";

export default function UnsavedChangesBar({ isDirty, onSave, onReset, isSaving = false, message = "You have unsaved changes.", resetLabel = "Reset", saveLabel = "Save" }) {
	const [transitionState, setTransitionState] = useState(isDirty ? "enter-from" : "hidden");

    useEffect(() => {
        if(!isDirty) {
            return;
        }

        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

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

    if(transitionState === "hidden") {
        return null;
    }

    return (
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
    );
}