// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	"embed"
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
)

type Chart struct {
	// Name of the Helm chart - this is free text, but should be the same as the chart name
	Name string

	// The entire chart content
	Content *embed.FS

	// Location is the location of the chart within the content
	Location string

	// AdditionalFiles list files in the content filesystem that
	// would be applied via "kubectl apply -f"
	AdditionalFiles []string
}

// Export writes the content of the chart to the dest location
func (c *Chart) Export(dest string) error {
	return fs.WalkDir(c.Content, ".", func(path string, d fs.DirEntry, err error) error {
		if !strings.HasPrefix(path, c.Location) {
			return nil
		}

		dst := filepath.Join(dest, strings.TrimPrefix(path, c.Location))
		if d.IsDir() {
			err := os.MkdirAll(dst, 0755)
			if err != nil {
				return err
			}
		} else {
			fc, err := c.Content.ReadFile(path)
			if err != nil {
				return err
			}
			err = ioutil.WriteFile(dst, fc, 0644)
			if err != nil {
				return err
			}
		}

		return nil
	})
}
