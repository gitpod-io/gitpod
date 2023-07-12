// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

import (
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"gopkg.in/yaml.v2"
)

//go:embed schema/*.yaml
var bootstrapFiles embed.FS

type file struct {
	name string
	data string
}

type SpiceDBSchema struct {
	Schema        string `yaml:"schema"`
	Relationships string `yaml:"relationships"`
}

func GetBootstrapFiles() ([]file, error) {
	files, err := fs.ReadDir(bootstrapFiles, "data")
	if err != nil {
		return nil, fmt.Errorf("failed to read bootstrap files: %w", err)
	}

	var filesWithContents []file
	for _, f := range files {
		b, err := fs.ReadFile(bootstrapFiles, fmt.Sprintf("%s/%s", "data", f.Name()))
		if err != nil {
			return nil, err
		}

		var schema SpiceDBSchema
		err = yaml.Unmarshal(b, &schema)
		if err != nil {
			return nil, fmt.Errorf("failed to parse file %s as yaml: %w", f.Name(), err)
		}

		data, err := yaml.Marshal(SpiceDBSchema{
			Schema: schema.Schema,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to serialize contents: %w", err)
		}

		// We only want to populate spicedb with the schema - we don't want to persist relationships or other data
		// This is because the relationships defined in this schema are used for validation, but can also be used to
		// import data into a running instance - we do not want that.
		// We cannot split the definitions across multiple files as that would prevent us from performing CI validation,
		// and we do not want to duplicate the schema.
		filesWithContents = append(filesWithContents, file{
			name: f.Name(),
			data: string(data),
		})
	}

	// ensure output is stable
	sort.Slice(filesWithContents, func(i, j int) bool {
		return strings.Compare(filesWithContents[i].name, filesWithContents[j].name) == -1
	})

	return filesWithContents, nil
}
