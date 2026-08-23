import React from "react";
import { Highlight, Prism } from "prism-react-renderer";
import { registerProjectDescriptionPrismLanguages } from "@/utils/markdown/registerPrismLanguages";

registerProjectDescriptionPrismLanguages(Prism);

const LANGUAGE_CLASS_RE = /(?:^|\s)language-([\w+-]{1,32})(?:\s|$)/i;
const LANGUAGE_ALIASES = {
	html: "markup",
	xml: "markup",
	js: "javascript",
	ts: "typescript",
	sh: "bash",
	shell: "bash",
	md: "markdown",
	yml: "yaml",
	py: "python",
	cs: "csharp",
	"c++": "cpp",
	kt: "kotlin",
	kts: "kotlin",
	gradle: "kotlin",
};
const getScopedTokenClassName = (className) => {
	const tokenTypes = className.split(/\s+/).filter((name) => name && name !== "token");
	return ["markdown-code-token", ...tokenTypes.map((name) => `markdown-code-token--${name}`)].join(" ");
};

const getCodeText = (value) => {
	if(typeof value === "string" || typeof value === "number") {
		return String(value);
	}

	if(Array.isArray(value)) {
		return value.map(getCodeText).join("");
	}

	if(React.isValidElement(value)) {
		return getCodeText(value.props.children);
	}

	return "";
};

const getLanguageFromNode = (value) => {
	if(Array.isArray(value)) {
		for(const child of value) {
			const language = getLanguageFromNode(child);
			if(language) {
				return language;
			}
		}

		return null;
	}

	if(!React.isValidElement(value)) {
		return null;
	}

	const className = typeof value.props.className === "string" ? value.props.className : "";
	const match = className.match(LANGUAGE_CLASS_RE);
	return match?.[1] || getLanguageFromNode(value.props.children);
};

const isJsonCode = (code) => {
	const value = code.trim();
	if(!value || !["{", "["].includes(value[0])) {
		return false;
	}

	try {
		JSON.parse(value);
		return true;
	} catch {
		return false;
	}
};

const inferCodeLanguage = (code) => {
	const value = code.trim();
	if(!value) {
		return null;
	}

	if(isJsonCode(value) || (/^[{[]/.test(value) && /"[^"\n]+"\s*:/.test(value))) {
		return "json";
	}

	if(/\b(?:plugins|dependencies)\s*\{|\b(?:val|var)\s+\w+\s+by\s+|\btasks\.\w+\s*\{/.test(value)) {
		return "kotlin";
	}

	if(/\bimport\s+[\w.]+;|\bpublic\s+(?:final\s+)?class\s+\w+|\bnew\s+[A-Z]\w*\s*\(/.test(value)) {
		return "java";
	}

	return null;
};

const getLanguageDetails = (children, code) => {
	const detectedLanguage = getLanguageFromNode(children)?.toLowerCase();
	const inferredLanguage = detectedLanguage ? null : inferCodeLanguage(code);
	const requestedLanguage = detectedLanguage || inferredLanguage;
	const normalizedLanguage = LANGUAGE_ALIASES[requestedLanguage] || requestedLanguage;
	const highlightLanguage = normalizedLanguage && Prism.languages[normalizedLanguage] ? normalizedLanguage : "plain";

	return highlightLanguage;
};

export default function MarkdownCodeBlock({ children }) {
	const code = getCodeText(children).replace(/\n$/, "");
	const highlightLanguage = getLanguageDetails(children, code);

	return (
		<figure className="markdown-code-block">
			<Highlight code={code} language={highlightLanguage}>
				{({ tokens, getTokenProps }) => (
					<pre className="markdown-code-block__pre">
						<code>
							{tokens.map((line, lineIndex) => (
								<React.Fragment key={lineIndex}>
									<span className="markdown-code-block__line">
										{line.map((token, tokenIndex) => {
											const { className: tokenClassName, children: tokenContent } = getTokenProps({ token });
											return <span className={getScopedTokenClassName(tokenClassName)} key={tokenIndex}>{token.empty ? "" : tokenContent}</span>;
										})}
									</span>
									{lineIndex < tokens.length - 1 ? "\n" : null}
								</React.Fragment>
							))}
						</code>
					</pre>
				)}
			</Highlight>
		</figure>
	);
}