// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package logs

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	// TerminalStoreLocation is the path in the workspace where terminal related data like logs or hist-files are
	// persisted in the file system
	TerminalStoreLocation = "/workspace/.gitpod"

	prebuildLogFilePrefix = "prebuild-log-"

	legacyTerminalStoreLocation = "/workspace"
	legacyPrebuildLogFilePrefix = ".prebuild-log-"

	// UploadedHeadlessLogPathPrefix is the prefix under which headless logs are stored inside an instance
	UploadedHeadlessLogPathPrefix = "logs"
)

// UploadedHeadlessLogPath returns the path relative to the workspace instance
func UploadedHeadlessLogPath(taskID string) string {
	return fmt.Sprintf("%s/%s", UploadedHeadlessLogPathPrefix, taskID)
}

// PrebuildLogFileName is the absolute path to the file containing the output of the prebuild log for the given task in recent workspaces
func PrebuildLogFileName(storeLocation string, taskId string) string {
	return storeLocation + "/" + prebuildLogFilePrefix + taskId
}

// LegacyPrebuildLogFileName is the absolute path to the file containing the output of the prebuild log for the given
// task in older workspaces
func LegacyPrebuildLogFileName(taskId string) string {
	return legacyTerminalStoreLocation + "/" + legacyPrebuildLogFilePrefix + taskId
}

// ListPrebuildLogFiles lists all log files in the workspace. Location is assumed to be the base dir of the workspace session
func ListPrebuildLogFiles(ctx context.Context, location string) (filePaths []string, err error) {
	listLogFiles := func(relativeLocation, prefix string) (logFiles []string, errr error) {
		absDirPath := filepath.Join(location, relativeLocation)
		files, err := os.ReadDir(absDirPath)
		if err != nil && !os.IsNotExist(err) {
			return nil, err
		}

		for _, file := range files {
			filename := file.Name()
			if strings.HasPrefix(filename, prefix) {
				absPath := filepath.Join(absDirPath, filename)
				logFiles = append(logFiles, absPath)
			}
		}
		return logFiles, nil
	}
	filePaths, err = listLogFiles(strings.TrimPrefix(TerminalStoreLocation, "/workspace"), prebuildLogFilePrefix)
	if err != nil {
		return nil, err
	}
	if len(filePaths) == 0 {
		filePaths, err = listLogFiles(strings.TrimPrefix(legacyTerminalStoreLocation, "/workspace"), legacyPrebuildLogFilePrefix)
		if err != nil {
			return nil, err
		}
	}
	return filePaths, nil
}

// ParseTaskIDFromPrebuildLogFilePath tries to parse the streamID from the given file name path
func ParseTaskIDFromPrebuildLogFilePath(filePath string) (string, error) {
	fileName := filepath.Base(filePath)

	var streamID string
	if strings.HasPrefix(fileName, legacyPrebuildLogFilePrefix) {
		streamID = strings.TrimPrefix(fileName, legacyPrebuildLogFilePrefix)
	} else if strings.HasPrefix(fileName, prebuildLogFilePrefix) {
		streamID = strings.TrimPrefix(fileName, prebuildLogFilePrefix)
	}
	if streamID == "" {
		return "", xerrors.Errorf("cannot parse stream ID from filePath: '%s'", fileName)
	}

	return streamID, nil
}
