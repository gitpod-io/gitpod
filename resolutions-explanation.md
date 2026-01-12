# Yarn Resolutions

Resolutions in `package.json` force specific versions of transitive dependencies. These are needed because yarn.lock pins older versions even when semver ranges allow newer ones.

| Package | Version | Reason |
|---------|---------|--------|
| sha.js | 2.4.12 | Pre-existing resolution |
| @babel/traverse | ^7.23.2 | CVE-2023-45133: arbitrary code execution via crafted code |
| browserify-sign | ^4.2.5 | Pulls in elliptic ^6.6.1 with security fixes |
| cipher-base | ^1.0.5 | CVE-2025-21531: prototype pollution vulnerability |
| elliptic | ^6.6.1 | CVE-2024-48949: signature verification bypass |
| loader-utils | ^2.0.4 | CVE-2022-37601: prototype pollution via url property |
| exec-sh | ^0.4.0 | Removes vulnerable merge@1.x dependency (GHSA-7wpw-2hjm-89gp) |
| pbkdf2 | ^3.1.3 | CVE-2025-21532: prototype pollution vulnerability |
| tough-cookie | ^4.1.3 | CVE-2023-26136: prototype pollution in cookie parsing |
