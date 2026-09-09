const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function buildPasswordRecoveryMail(url) {
	const title = "Reset your Modifold password";
	const description = "Choose a new password using the button below. This link is valid for 30 minutes and can only be used once.";
	const button = "Reset password";
	const ignore = "If you didn’t request this, ignore this email. Your password will stay the same.";
	const fallback = "If the button doesn’t work, copy this link into your browser:";
	const href = escapeHtml(url);
	return {
		subject: title,
		text: `${title}\n\n${description}\n\n${url}\n\n${ignore}`,
		html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#172033;">
	<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
		<tr><td align="center">
			<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:24px;">
				<tr><td style="padding:32px;text-align:center;">
					<img src="https://cdn.modifold.com/static/email-logo.png" width="48" height="48" alt="Modifold">
					<h1 style="margin:24px 0 16px;font-size:26px;line-height:34px;">${title}</h1>
					<p style="font-size:16px;line-height:24px;">${description}</p>
					<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;"><tr><td bgcolor="#307df0" style="border-radius:12px;"><a href="${href}" style="display:inline-block;padding:16px 24px;color:#fff;text-decoration:none;font-size:16px;font-weight:600;">${button}</a></td></tr></table>
					<p style="font-size:14px;line-height:22px;color:#595959;">${ignore}</p>
					<p style="margin-top:28px;font-size:12px;line-height:18px;color:#595959;">${fallback}</p>
					<p style="font-size:12px;line-height:18px;word-break:break-all;"><a href="${href}" style="color:#307df0;">${href}</a></p>
				</td></tr>
			</table>
		</td></tr>
	</table>
</body>
</html>`,
	};
}

module.exports = { buildPasswordRecoveryMail };