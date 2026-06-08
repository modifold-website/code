/**
 * @swagger
 * /tags/game-versions:
 *   get:
 *     summary: Get active game versions
 *     description: |
 *       Returns the list of active game versions from the database.
 *       Public URL example: https://api.modifold.com/tags/game-versions
 *
 *       Use these values when creating or editing a project version. Early Access is not used anymore;
 *       clients must send one or more real game versions, for example ["0.5.0-pre.9.1"] or ["0.5.0-pre.9.1","0.5.0-pre.9"].
 *       Versions are ordered from newest to oldest by database id.
 *     tags: [Tags]
 *     responses:
 *       200:
 *         description: Active game versions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 game_versions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 4
 *                       version:
 *                         type: string
 *                         example: "0.5.0-pre.9.1"
 *                       version_type:
 *                         type: string
 *                         enum: [release, pre-release]
 *                         example: release
 *                 versions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["0.5.0-pre.9.1", "0.5.0-pre.9", "0.5.0-pre.8", "2026.05.07-5efa15f6d", "2026.04.30-b4f6a911e", "2026.04.23-3f4475f43", "2026.04.23-937872667"]
 *             examples:
 *               success:
 *                 value:
 *                   game_versions:
 *                     - id: 7
 *                       version: "0.5.0-pre.9.1"
 *                       version_type: pre-release
 *                     - id: 6
 *                       version: "0.5.0-pre.9"
 *                       version_type: pre-release
 *                     - id: 5
 *                       version: "0.5.0-pre.8"
 *                       version_type: pre-release
 *                     - id: 4
 *                       version: "2026.05.07-5efa15f6d"
 *                       version_type: pre-release
 *                     - id: 3
 *                       version: "2026.04.30-b4f6a911e"
 *                       version_type: pre-release
 *                     - id: 2
 *                       version: "2026.04.23-3f4475f43"
 *                       version_type: pre-release
 *                     - id: 1
 *                       version: "2026.04.23-937872667"
 *                       version_type: pre-release
 *                   versions:
 *                     - "0.5.0-pre.9.1"
 *                     - "0.5.0-pre.9"
 *                     - "0.5.0-pre.8"
 *                     - "2026.05.07-5efa15f6d"
 *                     - "2026.04.30-b4f6a911e"
 *                     - "2026.04.23-3f4475f43"
 *                     - "2026.04.23-937872667"
 *       500:
 *         description: Server error while fetching game versions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error fetching game versions
 */