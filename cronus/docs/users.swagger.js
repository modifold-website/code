/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Update current user's profile
 *     description: |
 *       Updates username, description, social links, avatar photo.
 *       Requires authentication (JWT or API token).
 *       
 *       - Avatar are uploaded as multipart files
 *       - Social links are sent as JSON string or object
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username
 *                 example: NewUserName
 *               description:
 *                 type: string
 *                 description: Bio/description
 *               social_links:
 *                 type: string
 *                 description: JSON string with social links (youtube, telegram, x, discord)
 *                 example: '{"youtube":"https://youtube.com/@user","discord":"user#1234"}'
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: New profile avatar (JPEG/PNG/GIF, max 20MB)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 slug:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                 description:
 *                   type: string
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 social_links:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *       400:
 *         description: No data provided for update or invalid input
 *       401:
 *         description: Unauthorized (no valid token)
 *       500:
 *         description: Server error
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 */

/**
 * @swagger
 * /users/{username}/projects:
 *   get:
 *     summary: Get paginated list of user's approved projects
 *     description: |
 *       Returns list of approved projects where the user is either owner or member.
 *       Sorted by downloads descending by default.
 *       Public endpoint — no authentication required.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: User's username or slug
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projects:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       title:
 *                         type: string
 *                       summary:
 *                         type: string
 *                       icon_url:
 *                         type: string
 *                         nullable: true
 *                       downloads:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       project_type:
 *                         type: string
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: string
 *                       gallery:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             url:
 *                               type: string
 *                             featured:
 *                               type: integer
 *                       owner:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                             nullable: true
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       400:
 *         description: Invalid page or limit parameters
 *       500:
 *         description: Server error
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 */

/**
 * @swagger
 * /users/{username}:
 *   get:
 *     summary: Get public user profile by username/slug
 *     description: |
 *       Returns public information about a user (profile, stats, social links).
 *       Sensitive data (email, etc.) is excluded.
 *       Public endpoint — no authentication required.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: Username or slug
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 slug:
 *                   type: string
 *                 description:
 *                   type: string
 *                   nullable: true
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 isVerified:
 *                   type: boolean
 *                 isRole:
 *                   type: string
 *                   nullable: true
 *                 subscribers:
 *                   type: integer
 *                 subscriptions:
 *                   type: integer
 *                 social_links:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Delete current user account
 *     description: |
 *       Permanently deletes the user account and all related data:
 *       - All owned projects
 *       - Project versions, gallery, members, likes, analytics, ad impressions
 *       - Files from storage (projects folders)
 *       
 *       Requires authentication. This action is irreversible.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account and related data successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Account and all related data successfully deleted
 *       401:
 *         description: Unauthorized (no token)
 *       500:
 *         description: Server error during deletion
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */