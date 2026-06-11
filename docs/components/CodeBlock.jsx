"use client";

import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';

function normalizeCode(value) {
    return value.replace(/\n$/, '');
}

function normalizeLanguage(language) {
    if(!language) {
        return 'text';
    }

    const value = language.toLowerCase();

    if(value === 'shell') {
        return 'bash';
    }

    if(value === 'javascript') {
        return 'js';
    }

    if(value === 'typescript') {
        return 'ts';
    }

    return value;
}

function formatCode(code, language) {
    const normalized = normalizeCode(code);

    if(language !== 'json') {
        return normalized;
    }

    try {
        return JSON.stringify(JSON.parse(normalized), null, 2);
    } catch {
        return normalized;
    }
}

export default function CodeBlock({ code, language }) {
    const [copied, setCopied] = useState(false);

    const safeLanguage = useMemo(() => normalizeLanguage(language), [language]);
    const formattedCode = useMemo(() => formatCode(code, safeLanguage), [code, safeLanguage]);

    async function onCopy() {
        try {
            await navigator.clipboard.writeText(formattedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="code-frame">
            <div className="code-frame-top">
                <div className="code-frame-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
                <span className="code-language">{safeLanguage}</span>
            </div>

            <div className="code-frame-body">
                <button className="copy-code" onClick={onCopy} type="button" aria-label="Copy code">
                    {copied ? <Check className="endpoint-copy-check" size={16} /> : <Copy size={16} />}
                </button>

                <Highlight theme={themes.vsDark} code={formattedCode} language={safeLanguage}>
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre className={`${className} code-pre`} style={style}>
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })}>
                                    {line.map((token, key) => (
                                        <span key={key} {...getTokenProps({ token })} />
                                    ))}
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
            </div>
        </div>
    );
}