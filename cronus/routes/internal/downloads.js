const express = require("express");

const { countCdnDownload } = require("../../utils/downloadAccounting");

const router = express.Router();

router.all("/count", async (req, res) => {
	try {
		const result = await countCdnDownload(req);
		return res.status(result.status).json(result.body);
	} catch(error) {
		console.error("Error counting CDN download:", error);
		return res.status(500).json({ success: false, counted: false, reason: "internal_error", error: error.message });
	}
});

module.exports = router;