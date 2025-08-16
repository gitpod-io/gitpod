// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package detector

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/prometheus/client_golang/prometheus"
)

// mockFileClassifier is a mock implementation for testing
type mockFileClassifier struct{}

func (m *mockFileClassifier) MatchesFile(filePath string) (*classifier.Classification, error) {
	return &classifier.Classification{Level: classifier.LevelNoMatch}, nil
}

func (m *mockFileClassifier) GetFileSignatures() []*classifier.Signature {
	return nil
}

func (m *mockFileClassifier) Describe(d chan<- *prometheus.Desc)  {}
func (m *mockFileClassifier) Collect(m2 chan<- prometheus.Metric) {}

func TestFileDetector_Config_Defaults(t *testing.T) {
	tests := []struct {
		name           string
		inputConfig    FileScanningConfig
		expectedConfig FileScanningConfig
	}{
		{
			name: "all defaults",
			inputConfig: FileScanningConfig{
				Enabled:     true,
				WorkingArea: "/tmp/test-workspaces",
			},
			expectedConfig: FileScanningConfig{
				Enabled:      true,
				ScanInterval: 5 * time.Minute,
				MaxFileSize:  1024,
				WorkingArea:  "/tmp/test-workspaces",
			},
		},
		{
			name: "partial config",
			inputConfig: FileScanningConfig{
				Enabled:      true,
				ScanInterval: 10 * time.Minute,
				MaxFileSize:  2048,
				WorkingArea:  "/tmp/test-workspaces",
			},
			expectedConfig: FileScanningConfig{
				Enabled:      true,
				ScanInterval: 10 * time.Minute,
				MaxFileSize:  2048,
				WorkingArea:  "/tmp/test-workspaces",
			},
		},
		{
			name: "all custom values",
			inputConfig: FileScanningConfig{
				Enabled:      true,
				ScanInterval: 2 * time.Minute,
				MaxFileSize:  512,
				WorkingArea:  "/tmp/test-workspaces",
			},
			expectedConfig: FileScanningConfig{
				Enabled:      true,
				ScanInterval: 2 * time.Minute,
				MaxFileSize:  512,
				WorkingArea:  "/tmp/test-workspaces",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClassifier := &mockFileClassifier{}
			detector, err := NewfileDetector(tt.inputConfig, mockClassifier)
			if err != nil {
				t.Fatalf("failed to create detector: %v", err)
			}

			if detector.config.ScanInterval != tt.expectedConfig.ScanInterval {
				t.Errorf("ScanInterval = %v, expected %v", detector.config.ScanInterval, tt.expectedConfig.ScanInterval)
			}
			if detector.config.MaxFileSize != tt.expectedConfig.MaxFileSize {
				t.Errorf("MaxFileSize = %v, expected %v", detector.config.MaxFileSize, tt.expectedConfig.MaxFileSize)
			}
			if detector.config.WorkingArea != tt.expectedConfig.WorkingArea {
				t.Errorf("WorkingArea = %v, expected %v", detector.config.WorkingArea, tt.expectedConfig.WorkingArea)
			}
		})
	}
}

func TestFileDetector_DisabledConfig(t *testing.T) {
	config := FileScanningConfig{
		Enabled: false,
	}

	mockClassifier := &mockFileClassifier{}
	_, err := NewfileDetector(config, mockClassifier)
	if err == nil {
		t.Error("expected error when file scanning is disabled, got nil")
	}

	expectedError := "file scanning is disabled"
	if err.Error() != expectedError {
		t.Errorf("expected error %q, got %q", expectedError, err.Error())
	}
}

func TestWorkspaceDirectory_Fields(t *testing.T) {
	wsDir := WorkspaceDirectory{
		InstanceID: "inst789",
		Path:       "/var/gitpod/workspaces/inst789",
	}

	if wsDir.InstanceID != "inst789" {
		t.Errorf("InstanceID = %q, expected %q", wsDir.InstanceID, "inst789")
	}

	expectedPath := "/var/gitpod/workspaces/inst789"
	if wsDir.Path != expectedPath {
		t.Errorf("Path = %q, expected %q", wsDir.Path, expectedPath)
	}
}

func TestDiscoverWorkspaceDirectories(t *testing.T) {
	// Create a temporary working area
	tempDir, err := os.MkdirTemp("", "agent-smith-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create mock workspace directories
	workspaceIDs := []string{"ws-abc123", "ws-def456", "ws-ghi789"}
	for _, wsID := range workspaceIDs {
		wsDir := filepath.Join(tempDir, wsID)
		if err := os.Mkdir(wsDir, 0755); err != nil {
			t.Fatalf("failed to create workspace dir %s: %v", wsDir, err)
		}
	}

	// Create some files that should be ignored
	if err := os.Mkdir(filepath.Join(tempDir, ".hidden"), 0755); err != nil {
		t.Fatalf("failed to create hidden dir: %v", err)
	}
	if err := os.Mkdir(filepath.Join(tempDir, "ws-service-daemon"), 0755); err != nil {
		t.Fatalf("failed to create daemon dir: %v", err)
	}

	// Create detector with temp working area
	config := FileScanningConfig{
		Enabled:     true,
		WorkingArea: tempDir,
	}
	mockClassifier := &mockFileClassifier{}
	detector, err := NewfileDetector(config, mockClassifier)
	if err != nil {
		t.Fatalf("failed to create detector: %v", err)
	}

	// Test workspace directory discovery
	workspaceDirs, err := detector.discoverWorkspaceDirectories()
	if err != nil {
		t.Fatalf("failed to discover workspace directories: %v", err)
	}

	// Should find exactly 3 workspace directories (ignoring hidden and daemon dirs)
	if len(workspaceDirs) != 3 {
		t.Errorf("found %d workspace directories, expected 3", len(workspaceDirs))
	}

	// Verify the discovered directories
	foundIDs := make(map[string]bool)
	for _, wsDir := range workspaceDirs {
		foundIDs[wsDir.InstanceID] = true

		// Verify path is correct
		expectedPath := filepath.Join(tempDir, wsDir.InstanceID)
		if wsDir.Path != expectedPath {
			t.Errorf("workspace %s path = %q, expected %q", wsDir.InstanceID, wsDir.Path, expectedPath)
		}
	}

	// Verify all expected workspace IDs were found
	for _, expectedID := range workspaceIDs {
		if !foundIDs[expectedID] {
			t.Errorf("workspace ID %q not found in discovered directories", expectedID)
		}
	}
}

func TestFindMatchingFiles(t *testing.T) {
	// Create a temporary workspace directory
	tempDir, err := os.MkdirTemp("", "agent-smith-workspace-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test files
	testFiles := map[string]string{
		"config.json":        `{"key": "value"}`,
		"settings.conf":      `setting=value`,
		"script.sh":          `#!/bin/bash\necho "hello"`,
		"wallet.dat":         `wallet data`,
		"normal.txt":         `just text`,
		"subdir/nested.conf": `nested config`,
		"dotfiles/data.txt":  `some foobar thing`,
	}

	for filePath, content := range testFiles {
		fullPath := filepath.Join(tempDir, filePath)

		// Create directory if needed
		if dir := filepath.Dir(fullPath); dir != tempDir {
			if err := os.MkdirAll(dir, 0755); err != nil {
				t.Fatalf("failed to create dir %s: %v", dir, err)
			}
		}

		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			t.Fatalf("failed to create file %s: %v", fullPath, err)
		}
	}

	// Create detector
	config := FileScanningConfig{
		Enabled:     true,
		WorkingArea: "/tmp", // Not used in this test
	}
	mockClassifier := &mockFileClassifier{}
	detector, err := NewfileDetector(config, mockClassifier)
	if err != nil {
		t.Fatalf("failed to create detector: %v", err)
	}

	tests := []struct {
		name     string
		filename string
		expected []string
	}{
		{
			name:     "direct file match",
			filename: "config.json",
			expected: []string{filepath.Join(tempDir, "config.json")},
		},
		{
			name:     "wildcard pattern",
			filename: "*.conf",
			expected: []string{filepath.Join(tempDir, "settings.conf")},
		},
		{
			name:     "shell script pattern",
			filename: "*.sh",
			expected: []string{filepath.Join(tempDir, "script.sh")},
		},
		{
			name:     "no matches",
			filename: "*.nonexistent",
			expected: []string{},
		},
		{
			name:     "nonexistent direct file",
			filename: "missing.txt",
			expected: []string{},
		},
		{
			name:     "wildcard to dip into a sub-folder",
			filename: "*/data.txt",
			expected: []string{filepath.Join(tempDir, "dotfiles/data.txt")},
		},
		{
			name:     "exact match",
			filename: "dotfiles/data.txt",
			expected: []string{filepath.Join(tempDir, "dotfiles/data.txt")},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches := detector.findMatchingFiles(tempDir, tt.filename)

			if len(matches) != len(tt.expected) {
				t.Errorf("found %d matches, expected %d", len(matches), len(tt.expected))
				t.Errorf("matches: %v", matches)
				t.Errorf("expected: %v", tt.expected)
				return
			}

			// Convert to map for easier comparison
			matchMap := make(map[string]bool)
			for _, match := range matches {
				matchMap[match] = true
			}

			for _, expected := range tt.expected {
				if !matchMap[expected] {
					t.Errorf("expected match %q not found", expected)
				}
			}
		})
	}
}

func TestFileDetector_GetFileSignatures(t *testing.T) {
	// Create a mock classifier that returns some signatures
	mockClassifier := &mockFileClassifierWithSignatures{
		signatures: []*classifier.Signature{
			{
				Name:     "test-sig",
				Domain:   "filesystem",
				Filename: []string{"test.txt"},
			},
		},
	}

	config := FileScanningConfig{
		Enabled:     true,
		WorkingArea: "/tmp",
	}

	detector, err := NewfileDetector(config, mockClassifier)
	if err != nil {
		t.Fatalf("failed to create detector: %v", err)
	}

	signatures := detector.GetFileSignatures()
	if len(signatures) != 1 {
		t.Errorf("expected 1 signature, got %d", len(signatures))
	}

	if signatures[0].Name != "test-sig" {
		t.Errorf("expected signature name 'test-sig', got %s", signatures[0].Name)
	}
}

// mockFileClassifierWithSignatures is a mock that returns signatures
type mockFileClassifierWithSignatures struct {
	signatures []*classifier.Signature
}

func (m *mockFileClassifierWithSignatures) MatchesFile(filePath string) (*classifier.Classification, error) {
	return &classifier.Classification{Level: classifier.LevelNoMatch}, nil
}

func (m *mockFileClassifierWithSignatures) GetFileSignatures() []*classifier.Signature {
	return m.signatures
}

func (m *mockFileClassifierWithSignatures) Describe(d chan<- *prometheus.Desc)  {}
func (m *mockFileClassifierWithSignatures) Collect(m2 chan<- prometheus.Metric) {}
