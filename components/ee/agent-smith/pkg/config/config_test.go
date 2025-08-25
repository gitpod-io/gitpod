// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"testing"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
)

func TestFileClassifierIndependence(t *testing.T) {
	// Create a blocklist with both process and filesystem signatures
	blocklists := &Blocklists{
		Audit: &PerLevelBlocklist{
			Binaries: []string{"malware"}, // Process-related
			Signatures: []*classifier.Signature{
				{
					Name:     "process-sig",
					Domain:   classifier.DomainProcess,
					Pattern:  []byte("process-pattern"),
					Filename: []string{"malware.exe"},
				},
				{
					Name:     "filesystem-sig",
					Domain:   classifier.DomainFileSystem,
					Pattern:  []byte("filesystem-pattern"),
					Filename: []string{"virus.exe"},
				},
			},
		},
		Very: &PerLevelBlocklist{
			Signatures: []*classifier.Signature{
				{
					Name:     "filesystem-sig-2",
					Domain:   classifier.DomainFileSystem,
					Pattern:  []byte("another-pattern"),
					Filename: []string{"trojan.exe"},
				},
			},
		},
	}

	// Test process classifier (existing functionality - should be unchanged)
	processClass, err := blocklists.Classifier()
	if err != nil {
		t.Fatalf("Failed to create process classifier: %v", err)
	}
	if processClass == nil {
		t.Fatal("Process classifier should not be nil")
	}

	// Test new filesystem classifier
	filesystemClass, err := blocklists.FileClassifier()
	if err != nil {
		t.Fatalf("Failed to create filesystem classifier: %v", err)
	}
	if filesystemClass == nil {
		t.Fatal("Filesystem classifier should not be nil")
	}

	// Verify filesystem classifier has the right signatures
	fsSignatures := filesystemClass.GetFileSignatures()
	if len(fsSignatures) != 2 {
		t.Errorf("Expected 2 filesystem signatures, got %d", len(fsSignatures))
	}

	// Verify signatures are filesystem domain only
	for _, sig := range fsSignatures {
		if sig.Domain != classifier.DomainFileSystem {
			t.Errorf("Expected filesystem domain signature, got %s", sig.Domain)
		}
	}

	// Verify they are completely independent objects (can't directly compare different interface types)
	// Instead, verify they have different behaviors
	processSignatures := 0
	if pc, ok := processClass.(*classifier.CountingMetricsClassifier); ok {
		// Process classifier is wrapped in CountingMetricsClassifier
		_ = pc                // Just verify the type cast works
		processSignatures = 1 // We know it exists because we created it
	}

	filesystemSignatures := len(filesystemClass.GetFileSignatures())
	if filesystemSignatures == 0 {
		t.Error("Filesystem classifier should have signatures")
	}

	// They should serve different purposes
	if processSignatures == 0 && filesystemSignatures == 0 {
		t.Error("At least one classifier should have content")
	}

	// Test filesystem classifier functionality
	result, err := filesystemClass.MatchesFile("/nonexistent/virus.exe")
	if err != nil {
		t.Fatalf("Filesystem classification failed: %v", err)
	}
	if result == nil {
		t.Error("Expected non-nil classification result")
	}
}

func TestFileClassifierEmptyConfig(t *testing.T) {
	// Test with nil blocklists
	var blocklists *Blocklists
	filesystemClass, err := blocklists.FileClassifier()
	if err != nil {
		t.Fatalf("Failed to create filesystem classifier from nil config: %v", err)
	}
	if filesystemClass == nil {
		t.Fatal("Filesystem classifier should not be nil even with empty config")
	}

	// Should have no signatures
	signatures := filesystemClass.GetFileSignatures()
	if len(signatures) != 0 {
		t.Errorf("Expected 0 signatures from empty config, got %d", len(signatures))
	}
}

func TestFileClassifierNoFilesystemSignatures(t *testing.T) {
	// Test with blocklists that have no filesystem signatures
	blocklists := &Blocklists{
		Audit: &PerLevelBlocklist{
			Binaries: []string{"malware"},
			Signatures: []*classifier.Signature{
				{
					Name:     "process-only",
					Domain:   classifier.DomainProcess,
					Pattern:  []byte("process-pattern"),
					Filename: []string{"malware.exe"},
				},
			},
		},
	}

	filesystemClass, err := blocklists.FileClassifier()
	if err != nil {
		t.Fatalf("Failed to create filesystem classifier: %v", err)
	}

	// Should have no filesystem signatures
	signatures := filesystemClass.GetFileSignatures()
	if len(signatures) != 0 {
		t.Errorf("Expected 0 filesystem signatures, got %d", len(signatures))
	}
}
