require("dotenv").config();

const swaggerJsdoc = require("swagger-jsdoc");
const path = require('path');
const { API_BASE, STAGING } = require("./config/apiBase");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Modifold API",
            version: "1.0.0",
            description: `
## Authentication

To use protected API endpoints, you must include a Bearer token in the Authorization header:

**Authorization: Bearer <token>**

### Two types of tokens are supported:

1. **Regular JWT token**  
   - Obtained after successful login via Discord, Telegram, or GitHub  
   - Automatically stored in browser cookies (authToken) or localStorage  
   - Valid for **30 days** by default  

   Example:  
   "eyJhbGc..."

2. **Long-lived API token** (starts with "mf_")  
   - Recommended for bots, scripts, CI/CD, or external applications  
   - Created manually on the page: https://modifold.com/settings/api  
   - You choose the expiration: 1 week, 1 month, 3 months, 1 year, or **forever**  
   - Can be revoked at any time from the same page  

   Example:  
   "mf_abc123def456..."

**Important:**  
- Never share tokens publicly  
- Revoke leaked or compromised tokens immediately  
- API tokens have the same permissions as regular JWT tokens

## Rate Limiting

The API uses Redis-backed rate limiting for abuse protection and stability under high load.

- Limits are applied globally and can be stricter for heavy endpoints (for example, project listing/search-like routes).
- Responses include standard headers:
  - \`x-ratelimit-limit\`
  - \`x-ratelimit-remaining\`
  - \`x-ratelimit-reset\`
- When limit is exceeded, API returns \`429 Too Many Requests\` and \`retry-after\` header.

Use exponential backoff and respect \`retry-after\` for retries.
            `,
            contact: {
                name: "Modifold Team",
            },
        },
        servers: [
            {
                url: API_BASE,
                description: STAGING ? "Staging server" : "Production server"
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT or mf_ API token",
                    description: "Enter your JWT token or mf_ API token. Example: Bearer mf_abc123..."
                }
            },
            responses: {
                RateLimitExceeded: {
                    description: "Too many requests. Retry after the interval from the retry-after header.",
                    headers: {
                        "x-ratelimit-limit": {
                            description: "Maximum burst limit for current limiter bucket",
                            schema: { type: "integer" }
                        },
                        "x-ratelimit-remaining": {
                            description: "Remaining requests in current limiter bucket",
                            schema: { type: "integer" }
                        },
                        "x-ratelimit-reset": {
                            description: "Seconds until bucket reset",
                            schema: { type: "integer" }
                        },
                        "retry-after": {
                            description: "Seconds to wait before retrying",
                            schema: { type: "integer" }
                        }
                    },
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    message: { type: "string", example: "Rate limit exceeded" },
                                    retryAfterMs: { type: "integer", example: 1200 }
                                }
                            }
                        }
                    }
                }
            }
        },
    },
    apis: [
        path.join(__dirname, 'docs/**/*.js'),
        path.join(__dirname, 'routes/**/*.js'),
    ],
    failOnErrors: true,
};

const specs = swaggerJsdoc(options);

const shouldHideOperation = (operation) => {
    if(!operation || typeof operation !== "object") {
        return false;
    }

    return Boolean(operation["x-hidden"] || operation["x-internal"] || operation["x-private"]);
};

const filterHiddenOperations = (spec) => {
    if(!spec?.paths) {
        return spec;
    }

    for(const [pathKey, methods] of Object.entries(spec.paths)) {
        if(!methods || typeof methods !== "object") {
            continue;
        }

        for(const method of Object.keys(methods)) {
            if(shouldHideOperation(methods[method])) {
                delete methods[method];
            }
        }

        if(Object.keys(methods).length === 0) {
            delete spec.paths[pathKey];
        }
    }

    return spec;
};

filterHiddenOperations(specs);

module.exports = specs;