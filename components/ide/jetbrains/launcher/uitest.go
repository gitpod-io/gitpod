// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

func downloadUITestRobot(robotVersion, targetDir string) error {
	url := fmt.Sprintf("https://packages.jetbrains.team/maven/p/ij/intellij-dependencies/com/intellij/remoterobot/robot-server-plugin/%s/robot-server-plugin-%s.zip", robotVersion, robotVersion)
	downloadedFile, err := download(url, targetDir)
	if err != nil {
		return err
	}
	if err := unzipArchive(downloadedFile, targetDir); err != nil {
		return fmt.Errorf("failed to unzip %s: %v", downloadedFile, err)
	}
	_ = os.Remove(downloadedFile)
	robotDir := fmt.Sprintf("%s/robot-server-plugin-%s", targetDir, robotVersion)
	zipDir := fmt.Sprintf("%s/robot-server-plugin", targetDir)
	return os.Rename(zipDir, robotDir)
}

func download(url, targetDir string) (string, error) {
	_ = os.MkdirAll(targetDir, 0755)
	fileName := fmt.Sprintf("%s/%s", targetDir, filepath.Base(url))
	resp, err := http.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to download %s: %v", url, err)
	}
	out, err := os.Create(fileName)
	if err != nil {
		return "", fmt.Errorf("failed to create file %s: %v", fileName, err)
	}
	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to write to file %s: %v", fileName, err)
	}
	out.Close()
	resp.Body.Close()
	return fileName, nil
}
