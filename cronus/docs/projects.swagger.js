/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get list of approved projects (mods/modpacks/worlds)
 *     description: |
 *       Retrieves a paginated list of approved projects with filtering, sorting and search capabilities.
 *       Supports filtering by project type, tags, game versions, loaders, search by title.
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [mod, modpack, world]
 *         description: 'Project type filter ("mod", "modpack", or "world"). Plural aliases like "worlds" are accepted.'
 *         required: false
 *
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [downloads, recent]
 *           default: downloads
 *         description: 'Sorting method - by downloads count (default) or creation date'
 *         required: false
 *
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 'Search by project title (partial match)'
 *         required: false
 *
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 'Comma-separated list of tags (example: "Adventure,Optimization")'
 *         required: false
 *
 *       - in: query
 *         name: game_versions
 *         schema:
 *           type: string
 *         description: 'Comma-separated list of supported game versions from GET /tags/game-versions (example: "0.5.0-pre.9.1,0.5.0-pre.9"). Early Access is not used.'
 *         required: false
 *
 *       - in: query
 *         name: loaders
 *         schema:
 *           type: string
 *         description: 'Comma-separated list of supported mod loaders (example: "vanilla")'
 *         required: false
 *
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         required: false
 *
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of projects per page
 *         required: false
 *
 *     responses:
 *       200:
 *         description: Successful response with paginated list of projects
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
 *                       downloads:
 *                         type: integer
 *                       followers:
 *                         type: integer
 *                       color:
 *                         type: string
 *                         nullable: true
 *                       user_id:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       project_type:
 *                         type: string
 *                       license:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: string
 *                       game_versions:
 *                         type: array
 *                         items:
 *                           type: string
 *                       loaders:
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
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                             nullable: true
 *                           summary:
 *                             type: string
 *                             nullable: true
 *                           isVerified:
 *                             type: integer
 *                           type:
 *                             type: string
 *                             enum: [user, organization]
 *                           profile_url:
 *                             type: string
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *
 *       400:
 *         description: Invalid query parameters (wrong type, page, limit, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid project type
 *
 *       500:
 *         description: Server error during database query
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 *
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 */

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project (mod/modpack/world)
 *     description: |
 *       Creates a new project (mods, modpacks, or worlds).
 *       Requires authentication (JWT or API token starting with mf_).
 *       Uploads an icon file and creates project directory structure.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - summary
 *               - project_type
 *             properties:
 *               title:
 *                 type: string
 *                 description: Project title (used to generate slug)
 *                 example: Better Lighting Mod
 *                 minLength: 3
 *                 maxLength: 100
 *               summary:
 *                 type: string
 *                 description: Short description of the project
 *                 example: Improves lighting and adds realistic shadows
 *                 maxLength: 256
 *               visibility:
 *                 type: string
 *                 enum: [public, unlisted, private]
 *                 default: public
 *                 description: Project visibility level
 *               project_type:
 *                 type: string
 *                 enum: [mod, modpack, world]
 *                 description: Type of project
 *               icon:
 *                 type: string
 *                 format: binary
 *                 description: Project icon image (JPEG, PNG, GIF, WebP)
 *     responses:
 *       200:
 *         description: Project successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Generated unique project ID
 *                 slug:
 *                   type: string
 *                   description: URL-friendly slug based on title
 *                 title:
 *                   type: string
 *                 summary:
 *                   type: string
 *                 visibility:
 *                   type: string
 *                 project_type:
 *                   type: string
 *                 icon_url:
 *                   type: string
 *                   description: Public URL to uploaded icon
 *                 color:
 *                   type: string
 *                   nullable: true
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Validation error (missing required fields, invalid project type, or unable to generate unique slug)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     - Missing required fields or invalid project type
 *                     - Unable to generate unique slug
 *       401:
 *         description: Unauthorized - missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: No token provided
 *       500:
 *         description: Server error (database issue, file system error, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error creating project
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /projects/{slug}/settings:
 *   put:
 *     summary: Update basic project settings
 *     description: Updates title, summary and/or visibility of the project. Only the project owner can do this.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Project slug
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: New project title
 *                 example: Updated Lighting Mod
 *               summary:
 *                 type: string
 *                 description: New short description
 *                 example: Improved lighting with dynamic shadows
 *                 minLength: 30
 *                 maxLength: 256
 *               visibility:
 *                 type: string
 *                 enum: [public, unlisted, private]
 *                 description: New visibility level
 *               comments_enabled:
 *                 type: boolean
 *                 description: Enable or disable comments
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: No data provided or invalid summary
 *       403:
 *         description: Unauthorized or project not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /projects/{slug}/description:
 *   put:
 *     summary: Update project full description
 *     description: Updates the detailed description of the project. Only owner.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 description: Full project description (Markdown supported)
 *     responses:
 *       200:
 *         description: Description updated
 *       403:
 *         description: Unauthorized or project not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /projects/{slug}/license:
 *   put:
 *     summary: Update project license
 *     description: Changes license ID and/or name. Partial updates allowed.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               license_id:
 *                 type: string
 *                 description: License identifier (SPDX or custom)
 *               license_name:
 *                 type: string
 *                 description: Human-readable license name
 *     responses:
 *       200:
 *         description: License updated
 *       400:
 *         description: No data to update
 *       403:
 *         description: Unauthorized or project not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /projects/{slug}/links:
 *   put:
 *     summary: Update project external links
 *     description: Updates issue tracker, source code, wiki, Discord links. Partial updates supported.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               issue_url:
 *                 type: string
 *                 format: uri
 *               source_url:
 *                 type: string
 *                 format: uri
 *               wiki_url:
 *                 type: string
 *                 format: uri
 *               discord_url:
 *                 type: string
 *                 format: uri
 *               hytale_wiki_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Links updated
 *       400:
 *         description: No data to update
 *       403:
 *         description: Unauthorized or project not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /projects/{slug}/icon:
 *   put:
 *     summary: Upload or update project icon
 *     description: Replaces the project icon with a new image file.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - icon
 *             properties:
 *               icon:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Icon updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 icon_url:
 *                   type: string
 *                 color:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: No file uploaded
 *       403:
 *         description: Unauthorized or project not found
 *       500:
 *         description: Server error during file handling
 */

/**
 * @swagger
 * /projects/{slug}/versions:
 *   post:
 *     summary: Upload new project version (file)
 *     description: Creates a new version of the mod/project with uploaded JAR/file.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - version_number
 *               - game_versions
 *               - loaders
 *               - file
 *             properties:
 *               version_number:
 *                 type: string
 *               changelog:
 *                 type: string
 *               release_channel:
 *                 type: string
 *                 enum: [release, beta, alpha]
 *                 default: release
 *               game_versions:
 *                 type: string
 *                 description: JSON-stringified array of supported game versions from GET /tags/game-versions. Early Access is not used.
 *                 example: '["0.5.0-pre.9.1","0.5.0-pre.9"]'
 *               loaders:
 *                 type: string
 *                 description: JSON-stringified array of supported loaders
 *               dependencies:
 *                 type: string
 *                 description: JSON-stringified array of dependencies
 *                 example: '[{"slug":"mermaids","version_id":"oCK3bg","type":"required"}]'
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Version created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 versionId:
 *                   type: string
 *                 fileUrl:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /projects/{slug}/version/{version_number}:
 *   get:
 *     summary: Get details of a specific project version
 *     description: |
 *       Retrieves detailed information about a specific version of the project by its ID.
 *       Includes parsed game versions and loaders as arrays, and file information as an array of objects.
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Project slug
 *       - in: path
 *         name: version_number
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique version ID (not version number string)
 *     responses:
 *       200:
 *         description: Version details successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Unique version identifier
 *                 project_id:
 *                   type: string
 *                   description: ID of the parent project
 *                 version_number:
 *                   type: string
 *                   description: Version string (e.g. 1.0.0)
 *                 downloads:
 *                   type: integer
 *                   description: Number of times this version has been downloaded
 *                 changelog:
 *                   type: string
 *                   nullable: true
 *                   description: Changelog text (usually Markdown)
 *                 release_channel:
 *                   type: string
 *                   enum: [release, beta, alpha]
 *                   description: Release stability channel
 *                 game_versions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Supported Hytale game versions from GET /tags/game-versions. Early Access is not used.
 *                   example: ["0.5.0-pre.9.1", "0.5.0-pre.9"]
 *                 loaders:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Supported mod loaders
 *                   example: ["vanilla"]
 *                 file_url:
 *                   type: string
 *                   nullable: true
 *                   description: Public download URL of the version file
 *                 file_size:
 *                   type: integer
 *                   nullable: true
 *                   description: File size in bytes
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       url:
 *                         type: string
 *                       size:
 *                         type: integer
 *                       primary:
 *                         type: boolean
 *                   description: Array of files (currently only primary file)
 *                 dependencies:
 *                   type: array
 *                   description: Version dependencies
 *                   items:
 *                     type: object
 *                     properties:
 *                       project_id:
 *                         type: string
 *                       project_slug:
 *                         type: string
 *                       project_title:
 *                         type: string
 *                       project_icon_url:
 *                         type: string
 *                         nullable: true
 *                       project_type:
 *                         type: string
 *                         enum: [mod, modpack, world]
 *                       version_id:
 *                         type: string
 *                         nullable: true
 *                       version_number:
 *                         type: string
 *                         nullable: true
 *                       dependency_type:
 *                         type: string
 *                         enum: [required, optional, incompatible, embedded]
 *                   example:
 *                     - project_id: "abc123"
 *                       project_slug: "mermaids"
 *                       project_title: "Mermaids"
 *                       project_icon_url: "https://media.modifold.com/projects/abc123/icon.webp"
 *                       project_type: "mod"
 *                       version_id: "oCK3bg"
 *                       version_number: "1.0.0"
 *                       dependency_type: "required"
 *
 *       404:
 *         description: Project or version not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     - Project not found
 *                     - Version not found
 *
 *       500:
 *         description: Server error during database query
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /projects/{slug}/versions/{versionId}:
 *   put:
 *     summary: Update an existing project version
 *     description: |
 *       Updates version metadata (version number, changelog, release channel, 
 *       supported game versions, loaders) and optionally replaces the version file.
 *       
 *       Only the project owner can perform this action.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Project slug
 *       - in: path
 *         name: versionId
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique version ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               version_number:
 *                 type: string
 *                 description: New version number (e.g. 1.2.3)
 *               changelog:
 *                 type: string
 *                 nullable: true
 *                 description: Update changelog (Markdown supported)
 *               release_channel:
 *                 type: string
 *                 enum: [release, beta, alpha]
 *                 default: release
 *                 description: Release stability channel
 *               game_versions:
 *                 type: string
 *                 description: JSON-stringified array of supported game versions from GET /tags/game-versions. Early Access is not used.
 *                 example: '["0.5.0-pre.9.1","0.5.0-pre.9"]'
 *               loaders:
 *                 type: string
 *                 description: JSON-stringified array of supported loaders
 *                 example: ["vanilla"]
 *               dependencies:
 *                 type: string
 *                 description: JSON-stringified array of dependencies
 *                 example: '[{"slug":"mermaids","version_id":"oCK3bg","type":"required"}]'
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional new version file (replaces existing)
 *     responses:
 *       200:
 *         description: Version updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       403:
 *         description: Unauthorized or project not found
 *       404:
 *         description: Version not found
 *       500:
 *         description: Server error during update
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /projects/{slug}/versions/{versionId}:
 *   delete:
 *     summary: Delete a specific project version
 *     description: |
 *       Permanently deletes a version record from database and removes 
 *       its associated file from storage (if exists).
 *       
 *       Only the project owner can delete versions.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Project slug
 *       - in: path
 *         name: versionId
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique version ID to delete
 *     responses:
 *       200:
 *         description: Version deleted successfully
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
 *                   example: Version deleted successfully
 *       403:
 *         description: Unauthorized (not the project owner)
 *       404:
 *         description: Project or version not found
 *       500:
 *         description: Server error (database or file deletion issue)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /projects/{slug}/gallery:
 *   post:
 *     summary: Add image to project gallery
 *     description: Uploads a new screenshot/image to the project gallery.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               ordering:
 *                 type: integer
 *               featured:
 *                 type: boolean
 *                 description: Set as featured image (resets others)
 *     responses:
 *       200:
 *         description: Image added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 url:
 *                   type: string
 *       400:
 *         description: No image uploaded
 *       403:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /projects/{slug}/gallery/{galleryId}:
 *   put:
 *     summary: Update gallery image
 *     description: Updates title, description, order, featured status or replaces the image.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: galleryId
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               ordering:
 *                 type: integer
 *               featured:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: No data to update
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Gallery image not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /projects/{slug}/gallery/{galleryId}:
 *   delete:
 *     summary: Delete gallery image
 *     description: Removes image from gallery and deletes files from storage.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: galleryId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Project or gallery image not found
 *       500:
 *         description: Server error (partial file deletion possible)
 */

/**
 * @swagger
 * /projects/{slug}:
 *   get:
 *     summary: Get full project details by slug or ID
 *     description: |
 *       Returns complete information about a project including metadata, versions, gallery images, team members, and like status.
 *       Some fields (is_liked) depend on authentication.
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique project slug or project ID
 *     responses:
 *       200:
 *         description: Project details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Unique project identifier (random base64url string)
 *                 slug:
 *                   type: string
 *                   description: URL-friendly project identifier
 *                 project_type:
 *                   type: string
 *                   enum: [mod, modpack, world]
 *                   description: Type of project
 *                 title:
 *                   type: string
 *                   description: Project title
 *                 summary:
 *                   type: string
 *                   description: Short description for listing pages
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   description: Full detailed description (usually Markdown)
 *                 visibility:
 *                   type: string
 *                   enum: [public, unlisted, private]
 *                   description: Visibility level
 *                 comments_enabled:
 *                   type: boolean
 *                   description: Whether comments are enabled for this project
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                   description: Moderation status (approved, pending, rejected, etc.)
 *                 license:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       nullable: true
 *                     name:
 *                       type: string
 *                       nullable: true
 *                 issue_url:
 *                   type: string
 *                   format: uri
 *                   nullable: true
 *                 source_url:
 *                   type: string
 *                   format: uri
 *                   nullable: true
 *                 wiki_url:
 *                   type: string
 *                   format: uri
 *                   nullable: true
 *                 discord_url:
 *                   type: string
 *                   format: uri
 *                   nullable: true
 *                 hytale_wiki_slug:
 *                   type: string
 *                   nullable: true
 *                 hytale_wiki_url:
 *                   type: string
 *                   format: uri
 *                   nullable: true
 *                 icon_url:
 *                   type: string
 *                   description: Public URL to project icon
 *                 downloads:
 *                   type: integer
 *                   description: Total downloads across all versions
 *                 followers:
 *                   type: integer
 *                   description: Number of likes/follows
 *                 color:
 *                   type: string
 *                   nullable: true
 *                   description: Optional accent color (hex)
 *                 game_versions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Supported Hytale game versions (from main/latest version)
 *                 loaders:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Supported mod loaders
 *                 tags:
 *                   type: string
 *                   nullable: true
 *                   description: Project tags
 *                 user_id:
 *                   type: string
 *                   description: ID of the project owner
 *                 showProjectBackground:
 *                   type: boolean
 *                   description: Whether to display project background/cover image
 *                 owner:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     slug:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                       nullable: true
 *                     summary:
 *                       type: string
 *                       nullable: true
 *                     isVerified:
 *                       type: integer
 *                     type:
 *                       type: string
 *                       enum: [user, organization]
 *                     profile_url:
 *                       type: string
 *                 organization:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     slug:
 *                       type: string
 *                     name:
 *                       type: string
 *                     summary:
 *                       type: string
 *                       nullable: true
 *                     icon_url:
 *                       type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:
 *                         type: string
 *                       role:
 *                         type: string
 *                         example: Owner
 *                       status:
 *                         type: string
 *                         example: accept
 *                       username:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                         nullable: true
 *                 versions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       version_number:
 *                         type: string
 *                       changelog:
 *                         type: string
 *                         nullable: true
 *                       release_channel:
 *                         type: string
 *                         example: release
 *                       file_url:
 *                         type: string
 *                       file_size:
 *                         type: integer
 *                       game_versions:
 *                         type: string
 *                         description: Comma-separated (formatted for display)
 *                       loaders:
 *                         type: string
 *                         description: Comma-separated (formatted)
 *                       downloads:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 gallery:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       url:
 *                         type: string
 *                       raw_url:
 *                         type: string
 *                       title:
 *                         type: string
 *                         nullable: true
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       ordering:
 *                         type: integer
 *                       featured:
 *                         type: boolean
 *                 is_liked:
 *                   type: boolean
 *                   description: Whether current authenticated user has liked this project
 *                 permissions:
 *                   type: object
 *                   properties:
 *                     can_edit_details:
 *                       type: boolean
 *                     can_edit_body:
 *                       type: boolean
 *                     can_edit_gallery:
 *                       type: boolean
 *                     can_manage_versions:
 *                       type: boolean
 *                     can_delete_project:
 *                       type: boolean
 *
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project not found
 *
 *       500:
 *         description: Server error during data fetching
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /projects/{slug}:
 *   delete:
 *     summary: Delete a project
 *     description: |
 *       Permanently deletes the project, all its versions, categories, gallery images, 
 *       and associated files from the storage (MEDIA_ROOT/projects/{projectId}).
 *       
 *       Only the project owner can perform this action. 
 *       Files are deleted recursively; if deletion fails (e.g. permissions), 
 *       a warning is logged, but the database records are still removed.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique project slug
 *     responses:
 *       200:
 *         description: Project and associated data successfully deleted
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
 *                   example: Project and associated files deleted
 *       403:
 *         description: Unauthorized (not the project owner)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project not found
 *       500:
 *         description: Server error (database or file system issue)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update project by ID
 *     description: |
 *       Updates project title, summary, visibility, slug and/or icon.
 *       Only the project owner can perform this action.
 *       
 *       - Slug must be unique, lowercase, 1-30 characters, alphanumeric + hyphens
 *       - Icon upload replaces the existing one (multipart/form-data)
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Unique project ID (not slug)
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: New project title
 *                 example: Updated Epic Mod
 *               summary:
 *                 type: string
 *                 description: New short summary
 *                 minLength: 30
 *                 maxLength: 256
 *               visibility:
 *                 type: string
 *                 enum: [public, unlisted, private]
 *               comments_enabled:
 *                 type: boolean
 *                 description: Enable or disable comments
 *               slug:
 *                 type: string
 *                 description: New URL-friendly slug (must be unique)
 *                 pattern: ^[a-z0-9-]{1,30}$
 *               icon:
 *                 type: string
 *                 format: binary
 *                 description: Optional new icon file
 *     responses:
 *       200:
 *         description: Project updated successfully
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
 *                   example: Project updated
 *                 slug:
 *                   type: string
 *                   description: Updated or unchanged slug
 *       400:
 *         description: Invalid slug format or slug already taken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     - Slug must be 1-30 characters, lowercase, alphanumeric, or hyphens
 *                     - Slug is already taken
 *       403:
 *         description: Unauthorized (not the owner)
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error (database or file handling)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /projects/{slug}/comments:
 *   get:
 *     summary: Get project comments
 *     description: Returns threaded project comments (flat list with parent_id).
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Project slug
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectId:
 *                   type: string
 *                 ownerId:
 *                   type: string
 *                 viewerId:
 *                   type: string
 *                   nullable: true
 *                 canModerate:
 *                   type: boolean
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       parent_id:
 *                         type: integer
 *                         nullable: true
 *                       content:
 *                         type: string
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                       updated_at:
 *                         type: string
 *                       status:
 *                         type: string
 *                       author:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           username:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                             nullable: true
 *                           isVerified:
 *                             type: integer
 *                           isRole:
 *                             type: string
 *                             nullable: true
 *                       isAuthor:
 *                         type: boolean
 *       404:
 *         description: Project not found
 *       403:
 *         description: Comments are disabled for this project
 */

/**
 * @swagger
 * /projects/{slug}/comments:
 *   post:
 *     summary: Create a project comment
 *     description: Creates a new comment or reply (auth required).
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Project slug
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 parent_id:
 *                   type: integer
 *                   nullable: true
 *                 content:
 *                   type: string
 *                 created_at:
 *                   type: integer
 *                 updated_at:
 *                   type: integer
 *                 status:
 *                   type: string
 *                 author:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     slug:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                       nullable: true
 *                     isVerified:
 *                       type: integer
 *                     isRole:
 *                       type: string
 *                       nullable: true
 *                 isAuthor:
 *                   type: boolean
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Comments are disabled for this project
 *       429:
 *         description: Rate limited or duplicate content
 */

/**
 * @swagger
 * /projects/{slug}/comments/{commentId}:
 *   patch:
 *     summary: Moderate or delete a comment
 *     description: Allows comment author to delete, and project owner/moderator to hide/show/spam.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [delete, hide, show, spam]
 *     responses:
 *       200:
 *         description: Comment updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   enum: [deleted, hidden, visible, spam]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */