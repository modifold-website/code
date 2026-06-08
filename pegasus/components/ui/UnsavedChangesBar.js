"use client";

import { useEffect } from "react";

export default function UnsavedChangesBar({ isDirty, onSave, onReset, isSaving = false, message = "You have unsaved changes.", resetLabel = "Reset", saveLabel = "Save" }) {
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

    if(!isDirty) {
        return null;
    }

    return (
        <>
            <div aria-hidden="true" className="unsaved-changes-bar__spacer"></div>

            <div className="unsaved-changes-bar__wrap" role="status" aria-live="polite">
                <div className="unsaved-changes-bar">
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