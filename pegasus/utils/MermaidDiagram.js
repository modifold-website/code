"use client";

import React, { useEffect, useId, useRef, useState } from "react";

export default function MermaidDiagram({ code }) {
    const containerRef = useRef(null);
    const [error, setError] = useState(null);
    const diagramId = useId().replace(/:/g, "-");

    useEffect(() => {
        let isActive = true;

        const renderDiagram = async () => {
            if(!containerRef.current) {
                return;
            }

            setError(null);

            try {
                const mermaidModule = await import("mermaid");
                const mermaid = mermaidModule.default ?? mermaidModule;
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: "strict",
                });

                const { svg, bindFunctions } = await mermaid.render(`mermaid-${diagramId}`, code);

                if(!isActive || !containerRef.current) {
                    return;
                }

                containerRef.current.innerHTML = svg;
                if(typeof bindFunctions === "function") {
                    bindFunctions(containerRef.current);
                }
            } catch (err) {
                if(isActive) {
                    setError(err?.message || "Failed to render diagram.");
                }
            }
        };

        if(code?.trim()) {
            renderDiagram();
        }

        return () => {
            isActive = false;
        };
    }, [code, diagramId]);

    return (
        <div className="markdown-mermaid" data-mermaid>
            <div ref={containerRef} aria-live="polite" />
            
            {error ? (
                <pre className="markdown-mermaid__error">
                    <code>{error}</code>
                </pre>
            ) : null}
        </div>
    );
}