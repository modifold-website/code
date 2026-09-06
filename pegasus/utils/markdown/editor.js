const DEFAULT_LINK_TEMPLATE = "[link text](https://)";

const escapeMarkdownLinkLabel = (value) => value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");

export const insertMarkdownLink = ({ value, selectionStart, selectionEnd, template = DEFAULT_LINK_TEMPLATE }) => {
	const selected = value.slice(selectionStart, selectionEnd);
	if(!selected) {
		const nextValue = `${value.slice(0, selectionStart)}${template}${value.slice(selectionEnd)}`;
		const caret = selectionStart + template.length;
		return { value: nextValue, selectionStart: caret, selectionEnd: caret };
	}

	const labelEnd = template.indexOf("](");
	const destinationEnd = template.lastIndexOf(")");
	if(!template.startsWith("[") || labelEnd === -1 || destinationEnd < labelEnd) {
		const nextValue = `${value.slice(0, selectionStart)}${template}${value.slice(selectionEnd)}`;
		const caret = selectionStart + template.length;
		return { value: nextValue, selectionStart: caret, selectionEnd: caret };
	}

	const destination = template.slice(labelEnd + 2, destinationEnd);
	const link = `[${escapeMarkdownLinkLabel(selected)}](${destination})`;
	const destinationStart = selectionStart + link.indexOf("](") + 2;
	const nextValue = `${value.slice(0, selectionStart)}${link}${value.slice(selectionEnd)}`;

	return {
		value: nextValue,
		selectionStart: destinationStart,
		selectionEnd: destinationStart + destination.length,
	};
};