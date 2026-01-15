// Copyright (c) 2026 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"golang.org/x/net/http2"
)

const version = "0.1.0"

func main() {
	jsonOutput := flag.Bool("json", false, "Output results as JSON")
	verbose := flag.Bool("verbose", false, "Verbose output")
	skipReference := flag.Bool("skip-reference", false, "Skip reference test against google.com")
	timeout := flag.Duration("timeout", 30*time.Second, "Overall timeout")
	flag.Parse()

	if flag.NArg() < 1 {
		fmt.Fprintf(os.Stderr, "Usage: %s [options] <hostname>\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Example: %s api.gitpod.cloud\n", os.Args[0])
		flag.PrintDefaults()
		os.Exit(1)
	}

	target := flag.Arg(0)
	if !strings.Contains(target, ":") {
		target = target + ":443"
	}

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	diag := NewDiagnostic(target, *verbose)
	result := diag.Run(ctx, !*skipReference)

	if *jsonOutput {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(result)
	} else {
		printHumanReadable(result)
	}

	if !result.HTTP2.SettingsExchange.Success {
		os.Exit(1)
	}
}

func printHumanReadable(r *DiagResult) {
	fmt.Println("Gitpod Network Diagnostics")
	fmt.Println("==========================")
	fmt.Printf("Target: %s\n", r.Target)
	fmt.Printf("Time:   %s\n\n", r.Timestamp.Format(time.RFC3339))

	// Client info
	fmt.Printf("Client: %s/%s\n", r.Client.OS, r.Client.Arch)
	if r.Client.ProxyEnv.HTTPSProxy != "" {
		fmt.Printf("        HTTPS_PROXY=%s\n", r.Client.ProxyEnv.HTTPSProxy)
	}
	fmt.Println()

	// DNS
	status := "OK"
	if !r.DNS.Success {
		status = "FAIL"
	}
	fmt.Printf("[1] DNS Resolution: %s", status)
	if r.DNS.Success {
		fmt.Printf(" (%s, %dms)\n", strings.Join(r.DNS.ResolvedIPs, ", "), r.DNS.DurationMs)
	} else {
		fmt.Printf("\n    Error: %s\n", r.DNS.Error)
	}

	// TCP
	status = "OK"
	if !r.TCP.Success {
		status = "FAIL"
	}
	fmt.Printf("[2] TCP Connection: %s", status)
	if r.TCP.Success {
		fmt.Printf(" (%dms)\n", r.TCP.DurationMs)
	} else {
		fmt.Printf("\n    Error: %s\n", r.TCP.Error)
	}

	// TLS
	status = "OK"
	if !r.TLS.Success {
		status = "FAIL"
	}
	fmt.Printf("[3] TLS Handshake:  %s", status)
	if r.TLS.Success {
		fmt.Printf(" (%dms)\n", r.TLS.DurationMs)
		fmt.Printf("    Version:      %s\n", r.TLS.Version)
		fmt.Printf("    Cipher:       %s\n", r.TLS.CipherSuite)
		fmt.Printf("    ALPN:         %s\n", r.TLS.ALPNNegotiated)
		if len(r.TLS.CertChain) > 0 {
			fmt.Printf("    Cert Chain:\n")
			for i, cert := range r.TLS.CertChain {
				fmt.Printf("      [%d] %s (issuer: %s)\n", i, cert.Subject, cert.Issuer)
			}
		}
	} else {
		fmt.Printf("\n    Error: %s\n", r.TLS.Error)
	}

	// HTTP/2
	status = "OK"
	if !r.HTTP2.SettingsExchange.Success {
		status = "FAIL"
	}
	fmt.Printf("[4] HTTP/2 SETTINGS: %s", status)
	if r.HTTP2.SettingsExchange.Success {
		fmt.Printf(" (%dms)\n", r.HTTP2.SettingsExchange.DurationMs)
		if len(r.HTTP2.ServerSettings) > 0 {
			fmt.Printf("    Server settings:\n")
			for k, v := range r.HTTP2.ServerSettings {
				fmt.Printf("      %s: %d\n", k, v)
			}
		}
	} else {
		fmt.Printf("\n    Error: %s\n", r.HTTP2.SettingsExchange.Error)
		if r.HTTP2.SettingsExchange.ReceivedRaw != "" {
			fmt.Printf("    Received: %s\n", r.HTTP2.SettingsExchange.ReceivedRaw)
		}
	}

	// HTTP/1.1 test
	if r.HTTP1 != nil {
		status = "OK"
		if !r.HTTP1.Success {
			status = "FAIL"
		}
		fmt.Printf("[5] HTTP/1.1 Test:  %s", status)
		if r.HTTP1.Success {
			fmt.Printf(" (HTTP %d, %dms)\n", r.HTTP1.HTTPStatus, r.HTTP1.DurationMs)
		} else {
			fmt.Printf("\n    Error: %s\n", r.HTTP1.Error)
		}
	}

	// Connect-RPC test
	if r.ConnectRPC != nil {
		status = "OK"
		if !r.ConnectRPC.Success {
			status = "FAIL"
		}
		fmt.Printf("[6] Connect-RPC:    %s", status)
		if r.ConnectRPC.Success {
			fmt.Printf(" (HTTP %d, %dms)\n", r.ConnectRPC.HTTPStatus, r.ConnectRPC.DurationMs)
		} else {
			fmt.Printf("\n    Error: %s\n", r.ConnectRPC.Error)
		}
	}

	// WebSocket test
	if r.WebSocket != nil {
		status = "OK"
		if !r.WebSocket.Success {
			status = "FAIL"
		}
		fmt.Printf("[7] WebSocket:      %s", status)
		if r.WebSocket.Success {
			fmt.Printf(" (HTTP %d, %dms)\n", r.WebSocket.HTTPStatus, r.WebSocket.DurationMs)
		} else {
			fmt.Printf("\n    Error: %s\n", r.WebSocket.Error)
		}
	}

	// Reference test
	if r.ReferenceTest != nil {
		status = "OK"
		if !r.ReferenceTest.HTTP2Works {
			status = "FAIL"
		}
		fmt.Printf("[8] Reference Test: %s", status)
		fmt.Printf(" (%s)\n", r.ReferenceTest.Target)
		if !r.ReferenceTest.HTTP2Works && r.ReferenceTest.Error != "" {
			fmt.Printf("    Error: %s\n", r.ReferenceTest.Error)
		}
	}

	// Diagnosis
	fmt.Println()
	fmt.Println("Diagnosis")
	fmt.Println("---------")
	if r.Diagnosis.LikelyCause == "" {
		fmt.Println("No issues detected.")
	} else {
		fmt.Printf("Likely cause: %s\n", r.Diagnosis.LikelyCause)
		if len(r.Diagnosis.Evidence) > 0 {
			fmt.Printf("Evidence:\n")
			for _, e := range r.Diagnosis.Evidence {
				fmt.Printf("  - %s\n", e)
			}
		}
		if r.Diagnosis.Recommendation != "" {
			fmt.Printf("\nRecommendation: %s\n", r.Diagnosis.Recommendation)
		}
	}
}

// Data structures

type DiagResult struct {
	Timestamp     time.Time        `json:"timestamp"`
	Version       string           `json:"tool_version"`
	Target        string           `json:"target"`
	Client        ClientInfo       `json:"client"`
	DNS           DNSResult        `json:"dns"`
	TCP           TCPResult        `json:"tcp"`
	TLS           TLSResult        `json:"tls"`
	HTTP1         *HTTP1Result     `json:"http1,omitempty"`
	HTTP2         HTTP2Result      `json:"http2"`
	ConnectRPC    *ConnectResult   `json:"connect_rpc_test,omitempty"`
	WebSocket     *WebSocketResult `json:"websocket_test,omitempty"`
	ReferenceTest *RefTestResult   `json:"reference_test,omitempty"`
	Diagnosis     DiagnosisInfo    `json:"diagnosis"`
}

type ClientInfo struct {
	OS       string   `json:"os"`
	Arch     string   `json:"arch"`
	ProxyEnv ProxyEnv `json:"proxy_env"`
}

type ProxyEnv struct {
	HTTPProxy  string `json:"HTTP_PROXY,omitempty"`
	HTTPSProxy string `json:"HTTPS_PROXY,omitempty"`
	NoProxy    string `json:"NO_PROXY,omitempty"`
}

type DNSResult struct {
	Success     bool     `json:"success"`
	ResolvedIPs []string `json:"resolved_ips,omitempty"`
	DurationMs  int64    `json:"duration_ms,omitempty"`
	Error       string   `json:"error,omitempty"`
}

type TCPResult struct {
	Success    bool   `json:"success"`
	RemoteAddr string `json:"remote_addr,omitempty"`
	DurationMs int64  `json:"duration_ms,omitempty"`
	Error      string `json:"error,omitempty"`
}

type TLSResult struct {
	Success        bool       `json:"success"`
	Version        string     `json:"version,omitempty"`
	CipherSuite    string     `json:"cipher_suite,omitempty"`
	ALPNNegotiated string     `json:"alpn_negotiated,omitempty"`
	CertChain      []CertInfo `json:"cert_chain,omitempty"`
	DurationMs     int64      `json:"duration_ms,omitempty"`
	Error          string     `json:"error,omitempty"`
}

type CertInfo struct {
	Subject   string    `json:"subject"`
	Issuer    string    `json:"issuer"`
	NotBefore time.Time `json:"not_before"`
	NotAfter  time.Time `json:"not_after"`
}

type HTTP2Result struct {
	SettingsExchange SettingsExchangeResult `json:"settings_exchange"`
	ServerSettings   map[string]uint32      `json:"server_settings,omitempty"`
}

type SettingsExchangeResult struct {
	Success     bool   `json:"success"`
	Error       string `json:"error,omitempty"`
	ReceivedRaw string `json:"received_raw,omitempty"`
	DurationMs  int64  `json:"duration_ms,omitempty"`
}

type ConnectResult struct {
	Endpoint   string `json:"endpoint"`
	Success    bool   `json:"success"`
	HTTPStatus int    `json:"http_status,omitempty"`
	Error      string `json:"error,omitempty"`
	DurationMs int64  `json:"duration_ms,omitempty"`
}

type RefTestResult struct {
	Target     string `json:"target"`
	HTTP2Works bool   `json:"http2_works"`
	Error      string `json:"error,omitempty"`
}

type HTTP1Result struct {
	Success    bool   `json:"success"`
	HTTPStatus int    `json:"http_status,omitempty"`
	DurationMs int64  `json:"duration_ms,omitempty"`
	Error      string `json:"error,omitempty"`
}

type WebSocketResult struct {
	Endpoint   string `json:"endpoint"`
	Success    bool   `json:"success"`
	HTTPStatus int    `json:"http_status,omitempty"`
	Error      string `json:"error,omitempty"`
	DurationMs int64  `json:"duration_ms,omitempty"`
}

type DiagnosisInfo struct {
	LikelyCause    string   `json:"likely_cause,omitempty"`
	Evidence       []string `json:"evidence,omitempty"`
	Recommendation string   `json:"recommendation,omitempty"`
}

// Diagnostic implementation

type Diagnostic struct {
	target  string
	host    string
	port    string
	verbose bool
}

func NewDiagnostic(target string, verbose bool) *Diagnostic {
	host, port, _ := net.SplitHostPort(target)
	return &Diagnostic{
		target:  target,
		host:    host,
		port:    port,
		verbose: verbose,
	}
}

func (d *Diagnostic) Run(ctx context.Context, includeReference bool) *DiagResult {
	result := &DiagResult{
		Timestamp: time.Now().UTC(),
		Version:   version,
		Target:    d.target,
		Client:    d.getClientInfo(),
	}

	// DNS
	result.DNS = d.checkDNS(ctx)
	if !result.DNS.Success {
		result.Diagnosis = d.diagnose(result)
		return result
	}

	// TCP
	result.TCP = d.checkTCP(ctx)
	if !result.TCP.Success {
		result.Diagnosis = d.diagnose(result)
		return result
	}

	// TLS + HTTP/2 (combined since we need the connection)
	result.TLS, result.HTTP2, result.ConnectRPC = d.checkTLSAndHTTP2(ctx)

	// HTTP/1.1 test
	result.HTTP1 = d.checkHTTP1(ctx)

	// WebSocket test
	result.WebSocket = d.checkWebSocket(ctx)

	// Reference test
	if includeReference {
		result.ReferenceTest = d.checkReference(ctx)
	}

	result.Diagnosis = d.diagnose(result)
	return result
}

func (d *Diagnostic) getClientInfo() ClientInfo {
	return ClientInfo{
		OS:   runtime.GOOS,
		Arch: runtime.GOARCH,
		ProxyEnv: ProxyEnv{
			HTTPProxy:  os.Getenv("HTTP_PROXY"),
			HTTPSProxy: firstNonEmpty(os.Getenv("HTTPS_PROXY"), os.Getenv("https_proxy")),
			NoProxy:    os.Getenv("NO_PROXY"),
		},
	}
}

func (d *Diagnostic) checkDNS(ctx context.Context) DNSResult {
	start := time.Now()
	ips, err := net.DefaultResolver.LookupHost(ctx, d.host)
	duration := time.Since(start)

	if err != nil {
		return DNSResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	return DNSResult{
		Success:     true,
		ResolvedIPs: ips,
		DurationMs:  duration.Milliseconds(),
	}
}

func (d *Diagnostic) checkTCP(ctx context.Context) TCPResult {
	start := time.Now()
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", d.target)
	duration := time.Since(start)

	if err != nil {
		return TCPResult{
			Success: false,
			Error:   err.Error(),
		}
	}
	defer conn.Close()

	return TCPResult{
		Success:    true,
		RemoteAddr: conn.RemoteAddr().String(),
		DurationMs: duration.Milliseconds(),
	}
}

func (d *Diagnostic) checkTLSAndHTTP2(ctx context.Context) (TLSResult, HTTP2Result, *ConnectResult) {
	tlsResult := TLSResult{}
	http2Result := HTTP2Result{}

	// Connect with TLS
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", d.target)
	if err != nil {
		tlsResult.Error = err.Error()
		return tlsResult, http2Result, nil
	}

	tlsConfig := &tls.Config{
		ServerName: d.host,
		NextProtos: []string{"h2", "http/1.1"},
	}

	start := time.Now()
	tlsConn := tls.Client(conn, tlsConfig)
	err = tlsConn.HandshakeContext(ctx)
	tlsDuration := time.Since(start)

	if err != nil {
		conn.Close()
		tlsResult.Error = err.Error()
		return tlsResult, http2Result, nil
	}

	state := tlsConn.ConnectionState()
	tlsResult.Success = true
	tlsResult.DurationMs = tlsDuration.Milliseconds()
	tlsResult.Version = tlsVersionString(state.Version)
	tlsResult.CipherSuite = tls.CipherSuiteName(state.CipherSuite)
	tlsResult.ALPNNegotiated = state.NegotiatedProtocol

	// Extract cert chain
	for _, cert := range state.PeerCertificates {
		tlsResult.CertChain = append(tlsResult.CertChain, CertInfo{
			Subject:   cert.Subject.CommonName,
			Issuer:    cert.Issuer.CommonName,
			NotBefore: cert.NotBefore,
			NotAfter:  cert.NotAfter,
		})
	}

	// Check for MITM indicators
	if len(state.PeerCertificates) > 0 {
		issuer := state.PeerCertificates[0].Issuer.CommonName
		knownMITMIssuers := []string{"ZScaler", "Palo Alto", "Fortinet", "Blue Coat", "Symantec", "McAfee"}
		for _, mitm := range knownMITMIssuers {
			if strings.Contains(strings.ToLower(issuer), strings.ToLower(mitm)) {
				// Flag but don't fail - just note it
				break
			}
		}
	}

	// HTTP/2 check
	if state.NegotiatedProtocol != "h2" {
		http2Result.SettingsExchange = SettingsExchangeResult{
			Success: false,
			Error:   fmt.Sprintf("ALPN negotiated %q instead of h2", state.NegotiatedProtocol),
		}
		tlsConn.Close()
		return tlsResult, http2Result, nil
	}

	// Perform HTTP/2 SETTINGS exchange
	start = time.Now()
	transport := &http2.Transport{
		AllowHTTP: false,
	}
	h2Conn, err := transport.NewClientConn(tlsConn)
	settingsDuration := time.Since(start)

	if err != nil {
		errStr := err.Error()
		// Check for specific error patterns
		receivedRaw := ""
		if strings.Contains(errStr, "unexpected") || strings.Contains(errStr, "SETTINGS") {
			receivedRaw = "Server may have responded with HTTP/1.1 instead of HTTP/2"
		}
		http2Result.SettingsExchange = SettingsExchangeResult{
			Success:     false,
			Error:       errStr,
			ReceivedRaw: receivedRaw,
			DurationMs:  settingsDuration.Milliseconds(),
		}
		tlsConn.Close()
		return tlsResult, http2Result, nil
	}

	http2Result.SettingsExchange = SettingsExchangeResult{
		Success:    true,
		DurationMs: settingsDuration.Milliseconds(),
	}

	// Get detailed server settings via raw frame parsing
	if serverSettings, err := d.rawHTTP2Check(ctx); err == nil {
		http2Result.ServerSettings = serverSettings
	}

	// Try a Connect-RPC style request
	connectResult := d.tryConnectRPC(ctx, h2Conn)

	h2Conn.Close()
	return tlsResult, http2Result, connectResult
}

func (d *Diagnostic) tryConnectRPC(ctx context.Context, h2Conn *http2.ClientConn) *ConnectResult {
	result := &ConnectResult{
		Endpoint: "/gitpod.v1.WorkspaceService/GetWorkspace",
	}

	start := time.Now()

	// Create a Connect-RPC style request
	url := fmt.Sprintf("https://%s%s", d.host, result.Endpoint)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader([]byte{}))
	if err != nil {
		result.Error = err.Error()
		return result
	}
	req.Header.Set("Content-Type", "application/connect+proto")

	resp, err := h2Conn.RoundTrip(req)
	result.DurationMs = time.Since(start).Milliseconds()

	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()

	// Drain body
	io.Copy(io.Discard, resp.Body)

	result.HTTPStatus = resp.StatusCode
	// 415 (Unsupported Media Type) or 401 (Unauthorized) are expected without proper auth/body
	result.Success = resp.StatusCode == 415 || resp.StatusCode == 401 || resp.StatusCode == 200

	return result
}

func (d *Diagnostic) checkReference(ctx context.Context) *RefTestResult {
	result := &RefTestResult{
		Target: "www.google.com:443",
	}

	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", result.Target)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	tlsConfig := &tls.Config{
		ServerName: "www.google.com",
		NextProtos: []string{"h2", "http/1.1"},
	}

	tlsConn := tls.Client(conn, tlsConfig)
	err = tlsConn.HandshakeContext(ctx)
	if err != nil {
		conn.Close()
		result.Error = err.Error()
		return result
	}

	state := tlsConn.ConnectionState()
	if state.NegotiatedProtocol != "h2" {
		result.Error = fmt.Sprintf("ALPN negotiated %q instead of h2", state.NegotiatedProtocol)
		tlsConn.Close()
		return result
	}

	transport := &http2.Transport{}
	h2Conn, err := transport.NewClientConn(tlsConn)
	if err != nil {
		result.Error = err.Error()
		tlsConn.Close()
		return result
	}

	result.HTTP2Works = true
	h2Conn.Close()
	return result
}

func (d *Diagnostic) checkHTTP1(ctx context.Context) *HTTP1Result {
	result := &HTTP1Result{}

	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", d.target)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	// Force HTTP/1.1 only via ALPN
	tlsConfig := &tls.Config{
		ServerName: d.host,
		NextProtos: []string{"http/1.1"}, // Only offer HTTP/1.1
	}

	tlsConn := tls.Client(conn, tlsConfig)
	if err := tlsConn.HandshakeContext(ctx); err != nil {
		conn.Close()
		result.Error = err.Error()
		return result
	}
	defer tlsConn.Close()

	// Make a simple HTTP/1.1 request
	start := time.Now()
	req, _ := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://%s/", d.host), nil)

	// Use HTTP/1.1 transport
	transport := &http.Transport{
		DialTLSContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return tlsConn, nil
		},
		ForceAttemptHTTP2: false,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   10 * time.Second,
	}

	resp, err := client.Do(req)
	result.DurationMs = time.Since(start).Milliseconds()

	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	result.HTTPStatus = resp.StatusCode
	result.Success = resp.StatusCode > 0 && resp.StatusCode < 500

	return result
}

func (d *Diagnostic) checkWebSocket(ctx context.Context) *WebSocketResult {
	result := &WebSocketResult{
		Endpoint: "/api/gitpod",
	}

	// Derive the WebSocket host from the API host
	// api.xxx.gitpod.cloud -> xxx.gitpod.cloud for WebSocket
	wsHost := d.host
	if strings.HasPrefix(d.host, "api.") {
		wsHost = strings.TrimPrefix(d.host, "api.")
	}

	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", wsHost+":443")
	if err != nil {
		result.Error = err.Error()
		return result
	}

	tlsConfig := &tls.Config{
		ServerName: wsHost,
		NextProtos: []string{"http/1.1"}, // WebSocket upgrade uses HTTP/1.1
	}

	tlsConn := tls.Client(conn, tlsConfig)
	if err := tlsConn.HandshakeContext(ctx); err != nil {
		conn.Close()
		result.Error = fmt.Sprintf("TLS handshake failed: %v", err)
		return result
	}
	defer tlsConn.Close()

	// Send WebSocket upgrade request
	start := time.Now()
	upgradeReq := fmt.Sprintf(
		"GET %s HTTP/1.1\r\n"+
			"Host: %s\r\n"+
			"Upgrade: websocket\r\n"+
			"Connection: Upgrade\r\n"+
			"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"+
			"Sec-WebSocket-Version: 13\r\n"+
			"\r\n",
		result.Endpoint, wsHost)

	if _, err := tlsConn.Write([]byte(upgradeReq)); err != nil {
		result.Error = fmt.Sprintf("failed to send upgrade request: %v", err)
		return result
	}

	// Read response
	tlsConn.SetReadDeadline(time.Now().Add(10 * time.Second))
	respBuf := make([]byte, 4096)
	n, err := tlsConn.Read(respBuf)
	result.DurationMs = time.Since(start).Milliseconds()

	if err != nil {
		result.Error = fmt.Sprintf("failed to read response: %v", err)
		return result
	}

	respStr := string(respBuf[:n])

	// Parse HTTP status
	if strings.HasPrefix(respStr, "HTTP/1.1 ") {
		var status int
		fmt.Sscanf(respStr, "HTTP/1.1 %d", &status)
		result.HTTPStatus = status

		// 101 = Switching Protocols (WebSocket upgrade successful)
		// 401 = Unauthorized (expected without auth, but upgrade path works)
		// 400 = Bad Request (might be missing required headers)
		if status == 101 {
			result.Success = true
		} else if status == 401 {
			result.Success = true // Path exists, just needs auth
		} else {
			result.Error = fmt.Sprintf("unexpected status: %d", status)
		}
	} else {
		result.Error = fmt.Sprintf("unexpected response: %s", respStr[:min(100, len(respStr))])
	}

	return result
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (d *Diagnostic) diagnose(r *DiagResult) DiagnosisInfo {
	diag := DiagnosisInfo{}
	var evidence []string

	// Check for corporate MITM
	if r.TLS.Success && len(r.TLS.CertChain) > 0 {
		issuer := strings.ToLower(r.TLS.CertChain[0].Issuer)
		knownMITMIssuers := []string{"zscaler", "palo alto", "fortinet", "blue coat", "symantec", "mcafee", "forcepoint"}
		for _, mitm := range knownMITMIssuers {
			if strings.Contains(issuer, mitm) {
				evidence = append(evidence, fmt.Sprintf("Certificate issued by known SSL inspection vendor: %s", r.TLS.CertChain[0].Issuer))
				diag.LikelyCause = "corporate_ssl_inspection"
				break
			}
		}
	}

	// Check for HTTP/2 issues
	if !r.HTTP2.SettingsExchange.Success {
		if strings.Contains(r.HTTP2.SettingsExchange.Error, "protocol") ||
			strings.Contains(r.HTTP2.SettingsExchange.Error, "PROTOCOL") {
			evidence = append(evidence, "HTTP/2 protocol error during SETTINGS exchange")
			if diag.LikelyCause == "" {
				diag.LikelyCause = "http2_protocol_error"
			}
		}

		if r.TLS.ALPNNegotiated != "h2" {
			evidence = append(evidence, fmt.Sprintf("ALPN negotiated %q instead of h2 - possible protocol downgrade", r.TLS.ALPNNegotiated))
			diag.LikelyCause = "http2_downgrade"
		}
	}

	// Check HTTP/1.1 vs HTTP/2 comparison
	if r.HTTP1 != nil && r.HTTP1.Success && !r.HTTP2.SettingsExchange.Success {
		evidence = append(evidence, "HTTP/1.1 works but HTTP/2 fails - HTTP/2 specific issue")
		if diag.LikelyCause == "" {
			diag.LikelyCause = "http2_specific_failure"
		}
	}

	// Check WebSocket
	if r.WebSocket != nil && !r.WebSocket.Success {
		if r.HTTP1 != nil && r.HTTP1.Success {
			evidence = append(evidence, "HTTP/1.1 works but WebSocket upgrade fails - WebSocket may be blocked")
			if diag.LikelyCause == "" {
				diag.LikelyCause = "websocket_blocked"
			}
		}
	}

	// Check reference test
	if r.ReferenceTest != nil && !r.ReferenceTest.HTTP2Works {
		evidence = append(evidence, "HTTP/2 also fails to google.com - network-wide HTTP/2 issue")
		diag.LikelyCause = "network_http2_blocked"
	} else if r.ReferenceTest != nil && r.ReferenceTest.HTTP2Works && !r.HTTP2.SettingsExchange.Success {
		evidence = append(evidence, "HTTP/2 works to google.com but fails to Gitpod - Gitpod-specific issue")
	}

	// Set recommendation
	switch diag.LikelyCause {
	case "corporate_ssl_inspection":
		diag.Recommendation = "Contact IT to configure SSL inspection bypass for *.gitpod.cloud domains"
	case "http2_protocol_error":
		diag.Recommendation = "A network device is corrupting HTTP/2 frames. Contact IT to check proxy/firewall HTTP/2 support"
	case "http2_downgrade":
		diag.Recommendation = "A network device is downgrading HTTP/2 to HTTP/1.1. Contact IT to enable HTTP/2 passthrough"
	case "network_http2_blocked":
		diag.Recommendation = "HTTP/2 appears to be blocked network-wide. Contact IT to enable HTTP/2 support"
	case "http2_specific_failure":
		diag.Recommendation = "HTTP/2 is failing while HTTP/1.1 works. A network device may not support HTTP/2 correctly"
	case "websocket_blocked":
		diag.Recommendation = "WebSocket connections appear to be blocked. Contact IT to allow WebSocket upgrades"
	}

	diag.Evidence = evidence
	return diag
}

// HTTP/2 frame parsing for detailed diagnostics

const (
	http2FrameSettings   = 0x4
	http2FrameGoAway     = 0x7
	http2PrefaceLen      = 24
	http2FrameHeaderLen  = 9
	http2SettingEntryLen = 6
)

var http2Preface = []byte("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n")

var http2SettingNames = map[uint16]string{
	0x1: "HEADER_TABLE_SIZE",
	0x2: "ENABLE_PUSH",
	0x3: "MAX_CONCURRENT_STREAMS",
	0x4: "INITIAL_WINDOW_SIZE",
	0x5: "MAX_FRAME_SIZE",
	0x6: "MAX_HEADER_LIST_SIZE",
	0x8: "ENABLE_CONNECT_PROTOCOL",
}

// rawHTTP2Check performs a low-level HTTP/2 check to capture server settings
func (d *Diagnostic) rawHTTP2Check(ctx context.Context) (map[string]uint32, error) {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", d.target)
	if err != nil {
		return nil, err
	}

	tlsConfig := &tls.Config{
		ServerName: d.host,
		NextProtos: []string{"h2"},
	}

	tlsConn := tls.Client(conn, tlsConfig)
	if err := tlsConn.HandshakeContext(ctx); err != nil {
		conn.Close()
		return nil, err
	}
	defer tlsConn.Close()

	// Send HTTP/2 preface
	if _, err := tlsConn.Write(http2Preface); err != nil {
		return nil, fmt.Errorf("failed to send preface: %w", err)
	}

	// Send empty SETTINGS frame
	settingsFrame := []byte{
		0x00, 0x00, 0x00, // length = 0
		0x04,                   // type = SETTINGS
		0x00,                   // flags
		0x00, 0x00, 0x00, 0x00, // stream ID = 0
	}
	if _, err := tlsConn.Write(settingsFrame); err != nil {
		return nil, fmt.Errorf("failed to send SETTINGS: %w", err)
	}

	// Read server's SETTINGS frame
	tlsConn.SetReadDeadline(time.Now().Add(5 * time.Second))

	header := make([]byte, http2FrameHeaderLen)
	if _, err := io.ReadFull(tlsConn, header); err != nil {
		return nil, fmt.Errorf("failed to read frame header: %w", err)
	}

	frameLen := int(header[0])<<16 | int(header[1])<<8 | int(header[2])
	frameType := header[3]

	if frameType != http2FrameSettings {
		return nil, fmt.Errorf("expected SETTINGS frame (type 4), got type %d", frameType)
	}

	payload := make([]byte, frameLen)
	if _, err := io.ReadFull(tlsConn, payload); err != nil {
		return nil, fmt.Errorf("failed to read SETTINGS payload: %w", err)
	}

	// Parse settings
	settings := make(map[string]uint32)
	for i := 0; i+http2SettingEntryLen <= len(payload); i += http2SettingEntryLen {
		id := uint16(payload[i])<<8 | uint16(payload[i+1])
		val := uint32(payload[i+2])<<24 | uint32(payload[i+3])<<16 | uint32(payload[i+4])<<8 | uint32(payload[i+5])

		name := http2SettingNames[id]
		if name == "" {
			name = fmt.Sprintf("UNKNOWN_0x%x", id)
		}
		settings[name] = val
	}

	return settings, nil
}

// Helper functions

func tlsVersionString(v uint16) string {
	switch v {
	case tls.VersionTLS10:
		return "TLS1.0"
	case tls.VersionTLS11:
		return "TLS1.1"
	case tls.VersionTLS12:
		return "TLS1.2"
	case tls.VersionTLS13:
		return "TLS1.3"
	default:
		return fmt.Sprintf("unknown(0x%04x)", v)
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
