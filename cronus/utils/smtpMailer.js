const net = require("net");
const tls = require("tls");

const SMTP_TIMEOUT_MS = 15000;

function normalizeLines(value) {
	return String(value || "").replace(/\r?\n/g, "\r\n");
}

function dotStuff(value) {
	return normalizeLines(value).replace(/^\./gm, "..");
}

function readResponse(socket) {
	return new Promise((resolve, reject) => {
		let buffer = "";

		const cleanup = () => {
			socket.off("data", onData);
			socket.off("error", onError);
			socket.off("timeout", onTimeout);
		};

		const onData = (chunk) => {
			buffer += chunk.toString("utf8");
			const lines = buffer.split(/\r?\n/).filter(Boolean);
			const lastLine = lines[lines.length - 1] || "";

			if(/^\d{3} /.test(lastLine)) {
				cleanup();
				resolve(buffer);
			}
		};

		const onError = (error) => {
			cleanup();
			reject(error);
		};

		const onTimeout = () => {
			cleanup();
			reject(new Error("SMTP connection timed out"));
		};

		socket.on("data", onData);
		socket.on("error", onError);
		socket.on("timeout", onTimeout);
	});
}

async function command(socket, value, acceptedCodes) {
	socket.write(`${value}\r\n`);
	const response = await readResponse(socket);
	const code = Number(response.slice(0, 3));

	if(!acceptedCodes.includes(code)) {
		throw new Error(`SMTP command failed: ${response.trim()}`);
	}

	return response;
}

function createSocket() {
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT) || 1127;
	const secure = String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false";

	if(!host) {
		throw new Error("SMTP_HOST is not configured");
	}

	const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
	socket.setTimeout(SMTP_TIMEOUT_MS);

	return socket;
}

function buildMessage({ from, to, subject, html, text }) {
	const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
	const boundary = `modifold-${Date.now()}-${Math.random().toString(16).slice(2)}`;

	return [
		`From: Modifold <${from}>`,
		`To: ${to}`,
		`Subject: ${encodedSubject}`,
		"MIME-Version: 1.0",
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
		"",
		`--${boundary}`,
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		text,
		"",
		`--${boundary}`,
		"Content-Type: text/html; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		html,
		"",
		`--${boundary}--`,
	].join("\r\n");
}

async function sendMail({ to, subject, html, text }) {
	const from = process.env.SMTP_FROM || "no-reply@modifold.com";
	const username = process.env.SMTP_USER;
	const password = process.env.SMTP_PASS;

	if(!username || !password) {
		throw new Error("SMTP credentials are not configured");
	}

	const socket = createSocket();

	try {
		await readResponse(socket);
		await command(socket, "EHLO modifold.com", [250]);
		await command(socket, "AUTH LOGIN", [334]);
		await command(socket, Buffer.from(username).toString("base64"), [334]);
		await command(socket, Buffer.from(password).toString("base64"), [235]);
		await command(socket, `MAIL FROM:<${from}>`, [250]);
		await command(socket, `RCPT TO:<${to}>`, [250, 251]);
		await command(socket, "DATA", [354]);

		socket.write(`${dotStuff(buildMessage({ from, to, subject, html, text }))}\r\n.\r\n`);
		const dataResponse = await readResponse(socket);
		const dataCode = Number(dataResponse.slice(0, 3));

		if(dataCode !== 250) {
			throw new Error(`SMTP DATA failed: ${dataResponse.trim()}`);
		}

		await command(socket, "QUIT", [221]);
	} finally {
		socket.end();
	}
}

module.exports = { sendMail };