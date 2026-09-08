# Security Policy

## Supported Versions

kosame is currently pre-1.0 (`0.x`). Only the latest published version receives security fixes — there is no backport policy for older `0.x` releases.

## Reporting a Vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting for this repository: go to the **Security** tab → **Report a vulnerability**. This opens a private advisory visible only to the maintainer and you, so the issue can be discussed and fixed before it's public.

This is currently a solo-maintained project, so response times may vary, but reports will be acknowledged as soon as reasonably possible.

## Scope

kosame is a thin translation layer over [drizzle-orm](https://github.com/drizzle-team/drizzle-orm). Vulnerabilities in drizzle-orm itself, or in a database driver (`pg`, `mysql2`, `better-sqlite3`, `@libsql/client`), should be reported to those projects directly rather than here.
