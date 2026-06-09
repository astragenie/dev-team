---
name: mcp-integration
tier: domain
description: MCP server authoring and integration — config format, server types, security, performance, naming conventions, and testing patterns for Model Context Protocol integrations.
owner: hero-crew
last_reviewed: 2026-06-09
triggers: ["mcp", "mcpServers", "model context protocol", "mcp server", "mcp integration", ".mcp.json"]
---

## When to use

Consult when authoring or debugging an MCP server configuration: new integrations, authentication setup, performance tuning, or security hardening of existing MCP servers.

## Standard Config Format

```json
{
  "mcpServers": {
    "Service Name MCP": {
      "command": "npx",
      "args": ["-y", "package-name@latest"],
      "env": {
        "API_KEY": "required-env-var",
        "BASE_URL": "optional-base-url"
      }
    }
  }
}
```

## Server Types

| Type | Examples |
|---|---|
| API integration | GitHub, Stripe, Slack, REST/GraphQL connectors |
| Database connector | PostgreSQL, MySQL, MongoDB |
| Cloud service | AWS, GCP, Azure integrations |
| Dev tool | Linting, build systems, CI/CD, testing frameworks |
| Data source | File system, analytics, real-time streams |

## Config Templates

### API Integration

```json
{
  "mcpServers": {
    "GitHub Integration MCP": {
      "command": "npx",
      "args": ["-y", "github-mcp@latest"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here",
        "GITHUB_API_URL": "https://api.github.com",
        "RATE_LIMIT_REQUESTS": "5000",
        "RATE_LIMIT_WINDOW": "3600"
      }
    }
  }
}
```

### Database

```json
{
  "mcpServers": {
    "PostgreSQL MCP": {
      "command": "npx",
      "args": ["-y", "postgresql-mcp@latest"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/db",
        "MAX_CONNECTIONS": "10",
        "CONNECTION_TIMEOUT": "30000",
        "ENABLE_SSL": "true"
      }
    }
  }
}
```

### File System (restricted)

```json
{
  "mcpServers": {
    "Secure File Access MCP": {
      "command": "npx",
      "args": ["-y", "filesystem-mcp@latest"],
      "env": {
        "ALLOWED_PATHS": "/home/user/projects,/tmp",
        "MAX_FILE_SIZE": "10485760",
        "ALLOWED_EXTENSIONS": ".js,.ts,.json,.md,.txt",
        "ENABLE_WRITE": "false"
      }
    }
  }
}
```

## Security Checklist

- All secrets in env vars — never hardcoded
- Token rotation implemented where the API supports it
- Rate limiting and request throttling configured
- All inputs and responses validated
- Security events logged

## Performance

- Connection pooling for database MCPs
- Caching layer where reads dominate
- Batch operations for bulk data
- `MAX_CONNECTIONS` and `TIMEOUT` tuned per workload

## Naming Conventions

- File: `kebab-case.json` — `postgresql-database.json`, `github-repo-management.json`
- Server key: `"[Service] [Purpose] MCP"` — `"GitHub Repository MCP"`, `"PostgreSQL Database MCP"`

## Creation Checklist

1. Identify target service and auth method
2. Draft config with all required env vars documented
3. Validate JSON syntax
4. Test authentication and connection
5. Test error handling and edge cases
6. Verify cross-platform compatibility

## Done / Acceptance

MCP integration is complete when:
- Config JSON is valid and follows `mcpServers` structure
- All required env vars are documented with descriptions
- Auth connects successfully in test environment
- Error and timeout cases handled
- Security checklist passed
