"use client";

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export default function EndpointHeading({ id, method, path }) {
    const [copied, setCopied] = useState(false);

    async function onCopy() {
        try {
            await navigator.clipboard.writeText(path);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    }

    return (
        <h2 id={id} className="endpoint-heading">
            <span className={`http-method method-${method.toLowerCase()}`}>{method}</span>
            
            <span className="endpoint-path">{path}</span>
            
            <button className="endpoint-copy" type="button" onClick={onCopy} aria-label={`Copy ${method} ${path}`}>
                {copied ? <Check className="endpoint-copy-check" size={16} /> : <Copy size={16} />}
            </button>
        </h2>
    );
}