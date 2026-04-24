# Security Policy

## Reporting

Report suspected vulnerabilities privately to the project maintainers. Do not open a public issue with exploit details, tokens, private keys, user data, or local file paths.

## Supported Branch

Security fixes target `main` first. Release backports are handled case by case.

## Baseline Rules

- Tauri permissions must stay least-privilege.
- Asset and filesystem scopes must be exact directories, not broad `**`.
- CSP must not be weakened for performance.
- Shell execution must use argument arrays, never interpolated shell strings.
- SQL must use parameterized queries or SeaORM query builders.
- Secrets, signing keys, and updater private keys must never enter git.
- Logs must not include tokens, usernames, file content, or full private paths.

## Local Secret Handling

Use OS credential storage for user secrets where possible:

- macOS: Keychain
- Windows: Credential Manager / DPAPI
- Linux: Secret Service where available

Build and signing secrets belong in CI secret storage. Updater private keys must be kept offline.

## Dependency Checks

Run:

```bash
cargo audit
pnpm -s audit:frontend
```

High or critical findings block release unless the finding is demonstrably unreachable and documented.
