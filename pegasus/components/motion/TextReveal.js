"use client";

function getLines(text, segments) {
	if(segments) {
		return [segments];
	}

	const lines = Array.isArray(text) ? text : [text];
	return lines.map((line) => [{ text: line }]);
}

function getTokens(text) {
	return String(text || "").match(/\S+|\s+/g) || [];
}

export default function TextReveal({ text = "", segments, as: Component = "span", className = "", delay = 0, stagger = 0.08, blur = 12, yOffset = "40%" }) {
	const lines = getLines(text, segments);
	let unitIndex = 0;

	return (
		<Component className={`text-reveal ${className}`}>
			{lines.map((line, lineIndex) => (
				<span className="text-reveal__line" key={lineIndex}>
					{line.map((segment, segmentIndex) => (
						<span key={segmentIndex}>
							{getTokens(segment.text).map((token, tokenIndex) => {
								if(/^\s+$/.test(token)) {
									return token;
								}

								const currentIndex = unitIndex;
								unitIndex += 1;

								return (
									<span
										className={segment.className ? `text-reveal__unit ${segment.className}` : "text-reveal__unit"}
										key={`${token}-${tokenIndex}`}
										style={{
											"--text-reveal-delay": `${delay + currentIndex * stagger}s`,
											"--text-reveal-blur": `${blur}px`,
											"--text-reveal-y": yOffset,
										}}
									>
										{token}
									</span>
								);
							})}
						</span>
					))}
				</span>
			))}
		</Component>
	);
}