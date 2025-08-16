// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package detector

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/common-go/log"
)

// FileDetector discovers suspicious files on the node
type FileDetector interface {
	// DiscoverFiles based on a relative path match given the classifier's signatures
	DiscoverFiles(ctx context.Context) (<-chan File, error)
}

// File represents a file that might warrant closer inspection
type File struct {
	Path      string
	Workspace *common.Workspace
	Content   []byte
	Size      int64
	ModTime   time.Time
}

// fileDetector scans workspace filesystems for files matching signature criteria
type fileDetector struct {
	mu sync.RWMutex
	fs chan File

	config       FileScanningConfig
	classifier   classifier.FileClassifier
	lastScanTime time.Time

	startOnce sync.Once
}

// FileScanningConfig holds configuration for file scanning
type FileScanningConfig struct {
	Enabled      bool
	ScanInterval time.Duration
	MaxFileSize  int64
	WorkingArea  string
}

var _ FileDetector = &fileDetector{}

// NewfileDetector creates a new file detector
func NewfileDetector(config FileScanningConfig, fsClassifier classifier.FileClassifier) (*fileDetector, error) {
	if !config.Enabled {
		return nil, fmt.Errorf("file scanning is disabled")
	}

	// Set defaults
	if config.ScanInterval == 0 {
		config.ScanInterval = 5 * time.Minute
	}
	if config.MaxFileSize == 0 {
		config.MaxFileSize = 1024 // 1KB default
	}
	if config.WorkingArea == "" {
		return nil, fmt.Errorf("workingArea must be specified")
	}

	return &fileDetector{
		config:       config,
		classifier:   fsClassifier,
		lastScanTime: time.Time{}, // Zero time means never scanned
	}, nil
}

func (det *fileDetector) start(ctx context.Context) {
	fs := make(chan File, 100)
	go func() {
		ticker := time.NewTicker(det.config.ScanInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				close(fs)
				return
			case <-ticker.C:
				det.scanWorkspaces(fs)
			}
		}
	}()

	go func() {
		for f := range fs {
			// Convert FilesystemFile to SuspiciousFile for compatibility
			file := File{
				Path:      f.Path,
				Workspace: f.Workspace,
				Content:   nil, // Content will be read by signature matcher
				Size:      f.Size,
				ModTime:   f.ModTime,
			}
			det.fs <- file
		}
	}()

	log.Info("filesystem detector started")
}

func (det *fileDetector) scanWorkspaces(files chan<- File) {
	// Get filesystem signatures to know what files to look for
	filesystemSignatures := det.GetFileSignatures()
	if len(filesystemSignatures) == 0 {
		log.Warn("no filesystem signatures configured, skipping scan")
		return
	}

	// Scan working area directory for workspace directories
	workspaceDirs, err := det.discoverWorkspaceDirectories()
	if err != nil {
		log.WithError(err).Error("failed to discover workspace directories")
		return
	}

	log.Infof("found %d workspace directories, scanning for %d filesystem signatures", len(workspaceDirs), len(filesystemSignatures))

	for _, wsDir := range workspaceDirs {
		det.scanWorkspaceDirectory(wsDir, filesystemSignatures, files)
	}
}

// GetFileSignatures returns signatures that should be used for filesystem scanning
// These are extracted from the configured classifier
func (det *fileDetector) GetFileSignatures() []*classifier.Signature {
	if det.classifier == nil {
		return nil
	}

	// Use the FileClassifier interface to get signatures
	return det.classifier.GetFileSignatures()
}

// discoverWorkspaceDirectories scans the working area for workspace directories
func (det *fileDetector) discoverWorkspaceDirectories() ([]WorkspaceDirectory, error) {
	entries, err := os.ReadDir(det.config.WorkingArea)
	if err != nil {
		return nil, fmt.Errorf("cannot read working area %s: %w", det.config.WorkingArea, err)
	}

	var workspaceDirs []WorkspaceDirectory
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		// Skip hidden directories and service directories (ending with -daemon)
		name := entry.Name()
		if strings.HasPrefix(name, ".") || strings.HasSuffix(name, "-daemon") {
			continue
		}

		workspaceDir := WorkspaceDirectory{
			InstanceID: name,
			Path:       filepath.Join(det.config.WorkingArea, name),
		}
		workspaceDirs = append(workspaceDirs, workspaceDir)
	}

	return workspaceDirs, nil
}

// WorkspaceDirectory represents a workspace directory on disk
type WorkspaceDirectory struct {
	InstanceID string
	Path       string
}

func (det *fileDetector) scanWorkspaceDirectory(wsDir WorkspaceDirectory, signatures []*classifier.Signature, files chan<- File) {
	// Create a minimal workspace object for this directory
	workspace := &common.Workspace{
		InstanceID: wsDir.InstanceID,
		// We don't have other workspace metadata from directory scanning
		// These would need to be populated from other sources if needed
	}

	// For each signature, check if any of its target files exist
	for _, sig := range signatures {
		for _, relativeFilePath := range sig.Filename {
			matchingFiles := det.findMatchingFiles(wsDir.Path, relativeFilePath)

			for _, filePath := range matchingFiles {
				// Check if file exists and get its info
				info, err := os.Stat(filePath)
				if err != nil {
					continue
				}

				// Skip directories
				if info.IsDir() {
					continue
				}

				// Size check
				size := info.Size()
				if size == 0 || size > det.config.MaxFileSize {
					log.Warnf("File size is too large, skipping: %s", filePath)
					continue
				}

				file := File{
					Path:      filePath,
					Workspace: workspace,
					Content:   nil, // Content will be read by signature matcher if needed
					Size:      size,
					ModTime:   info.ModTime(),
				}

				log.Infof("Found matching file: %s (pattern: %s, signature: %s, size: %d bytes)", filePath, relativeFilePath, sig.Name, size)

				select {
				case files <- file:
					log.Infof("File sent to channel: %s", filePath)
				default:
					log.Warnf("File dropped (channel full): %s", filePath)
				}
			}
		}
	}
}

// findMatchingFiles finds files matching a pattern (supports wildcards and relative paths)
func (det *fileDetector) findMatchingFiles(workspaceRoot, relativeFilePath string) []string {
	// For wildcard relativeFilePaths, we need to search within the workspace
	// For simplicity, only search in the root directory for now
	// TODO: Could be extended to search subdirectories up to WorkspaceDepth
	matches, err := filepath.Glob(filepath.Join(workspaceRoot, relativeFilePath))
	if err != nil {
		return nil
	}

	return matches
}

// DiscoverFiles starts filesystem discovery. Must not be called more than once.
func (det *fileDetector) DiscoverFiles(ctx context.Context) (<-chan File, error) {
	det.mu.Lock()
	defer det.mu.Unlock()

	if det.fs != nil {
		return nil, fmt.Errorf("already discovering files")
	}

	res := make(chan File, 100)
	det.fs = res
	det.startOnce.Do(func() { det.start(ctx) })

	return res, nil
}
