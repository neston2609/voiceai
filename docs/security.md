# Security

Do not hardcode secrets in source.

Secrets that must remain environment-backed or encrypted:

- Database password
- AI API keys
- Google service account JSON
- FreePBX/Asterisk ARI username/password
- JWT secrets
- Encryption key

Implemented safeguards:

- bcrypt password hashing
- first-login password change flag
- JWT access tokens
- login rate limiting
- account lockout fields
- encrypted secret helper
- secret masking helper
- correlation ID middleware
- Helmet security headers
- CORS from environment
- audit-log model and seeded audit entry

Production work should persist refresh token rotation and audit every configuration change through the Prisma-backed services.
