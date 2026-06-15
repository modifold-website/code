const express = require("express");
const { db } = require("../../config/db");
const auth = require("../../middleware/auth");
const { sanitizePlainText } = require("../../utils/sanitize");

const router = express.Router();

const REPORT_REASON_CODES = [
    "spam",
    "malware",
    "copyright",
    "nsfw",
    "fraud",
    "rules_violation",
    "other",
];

const REPORT_COMMENT_MAX_LENGTH = 1000;

const getProjectBySlug = async (slug) => {
    const [rows] = await db.query(
        "SELECT id, slug, title, user_id, status FROM projects WHERE slug = ? LIMIT 1",
        [slug]
    );

    return rows[0] || null;
};

router.get("/projects/:slug/my-status", auth, async (req, res) => {
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const [rows] = await db.query(
            `SELECT id, reason_code, comment, status, created_at, resolved_at
            FROM project_reports
            WHERE project_id = ? AND reporter_user_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
            [project.id, req.user.id]
        );

        const report = rows[0] || null;

        return res.json({
            has_reported: Boolean(report),
            can_report: !report,
            report,
        });
    } catch (error) {
        console.error("Error fetching report status:", error);
        return res.status(500).json({ message: "Error fetching report status" });
    }
});

router.post("/projects/:slug", auth, async (req, res) => {
    try {
        const project = await getProjectBySlug(req.params.slug);
        if(!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const reasonCode = String(req.body?.reason || "").trim();
        if(!REPORT_REASON_CODES.includes(reasonCode)) {
            return res.status(400).json({ message: "Invalid report reason" });
        }

        const rawComment = req.body?.comment ?? "";
        const comment = sanitizePlainText(rawComment, { preserveNewlines: true }) || null;

        if(comment && comment.length > REPORT_COMMENT_MAX_LENGTH) {
            return res.status(400).json({ message: "Comment too long" });
        }

        const [existingRows] = await db.query(
            "SELECT id FROM project_reports WHERE project_id = ? AND reporter_user_id = ? LIMIT 1",
            [project.id, req.user.id]
        );

        if(existingRows.length) {
            return res.status(409).json({ message: "Report already submitted" });
        }

        const [insertResult] = await db.query(
            `INSERT INTO project_reports
            (project_id, project_slug, project_title_snapshot, reported_project_owner_id, reporter_user_id, reason_code, comment, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NOW(), NOW())`,
            [
                project.id,
                project.slug,
                project.title,
                project.user_id || null,
                req.user.id,
                reasonCode,
                comment,
            ]
        );

        return res.status(201).json({
            success: true,
            report: {
                id: insertResult.insertId,
                reason_code: reasonCode,
                comment,
                status: "open",
            },
        });
    } catch (error) {
        if(error && error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Report already submitted" });
        }

        console.error("Error creating report:", error);
        return res.status(500).json({ message: "Error creating report" });
    }
});

module.exports = router;