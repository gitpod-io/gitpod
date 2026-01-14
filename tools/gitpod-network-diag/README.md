# Gitpod Network Diagnostic Tool

A diagnostic tool to help identify network issues affecting Gitpod connectivity, particularly HTTP/2 and TLS-related problems caused by corporate proxies and firewalls.

## Usage

```bash
# Basic usage
./gitpod-network-diag api.gitpod.cloud

# JSON output for programmatic analysis
./gitpod-network-diag --json api.gitpod.cloud

# Skip reference test (faster)
./gitpod-network-diag --skip-reference api.gitpod.cloud

# Verbose output
./gitpod-network-diag --verbose api.gitpod.cloud
```

## What it checks

1. **DNS Resolution** - Verifies the hostname resolves correctly
2. **TCP Connection** - Tests basic connectivity to the server
3. **TLS Handshake** - Checks TLS version, cipher suite, ALPN negotiation, and certificate chain
4. **HTTP/2 SETTINGS Exchange** - Verifies HTTP/2 protocol works correctly
5. **Connect-RPC Test** - Makes a test request similar to VSCode Desktop
6. **Reference Test** - Compares HTTP/2 behavior against google.com to isolate Gitpod-specific issues

## Diagnosis

The tool automatically detects common issues:

- **Corporate SSL Inspection** - Detects known SSL inspection vendors (ZScaler, Palo Alto, etc.)
- **HTTP/2 Protocol Errors** - Identifies when HTTP/2 frames are being corrupted
- **HTTP/2 Downgrade** - Detects when a middlebox is forcing HTTP/1.1
- **Network-wide HTTP/2 Issues** - Distinguishes between Gitpod-specific and general HTTP/2 problems

## Example Output

```
Gitpod Network Diagnostics
==========================
Target: api.gitpod.cloud:443
Time:   2026-01-14T17:00:00Z

Client: darwin/arm64
        HTTPS_PROXY=http://proxy.corp:8080

[1] DNS Resolution: OK (35.241.252.3, 12ms)
[2] TCP Connection: OK (23ms)
[3] TLS Handshake:  OK (45ms)
    Version:      TLS1.3
    Cipher:       TLS_AES_128_GCM_SHA256
    ALPN:         h2
    Cert Chain:
      [0] *.gitpod.cloud (issuer: ZScaler Root CA)
[4] HTTP/2 SETTINGS: FAIL
    Error: protocol error during SETTINGS exchange
[5] Connect-RPC:    FAIL
    Error: stream reset
[6] Reference Test: OK (www.google.com:443)

Diagnosis
---------
Likely cause: corporate_ssl_inspection
Evidence:
  - Certificate issued by known SSL inspection vendor: ZScaler Root CA
  - HTTP/2 protocol error during SETTINGS exchange

Recommendation: Contact IT to configure SSL inspection bypass for *.gitpod.cloud domains
```

## Building

```bash
# Build for current platform
go build -o gitpod-network-diag .

# Build for all platforms
make build-all
```

## Sharing Results

When reporting issues, please run with `--json` flag and share the output:

```bash
./gitpod-network-diag --json api.gitpod.cloud > network-diag.json
```
