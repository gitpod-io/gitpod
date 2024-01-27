// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package postprocess

import (
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/yq"
	"sigs.k8s.io/yaml"
)

func generateOverrideKey(apiVersion, kind, name string) string {
	return strings.ToLower(fmt.Sprintf("%s-%s-%s", apiVersion, kind, name))
}

// Merge two YAML strings together
func Merge(original string, data string) (*string, error) {
	// Generate a temp directory and file
	dir, err := os.MkdirTemp("", "override")
	if err != nil {
		return nil, err
	}
	fileName := path.Join(dir, "data.yaml")

	// Write the override file
	if err := os.WriteFile(fileName, []byte(data), 0644); err != nil {
		return nil, err
	}

	// Use yq to merge two files together
	// @link https://mikefarah.gitbook.io/yq/operators/multiply-merge#merge-two-files-together
	output, err := yq.Process(original, fmt.Sprintf(`. *= load("%s")`, fileName))
	if err != nil {
		return nil, err
	}

	return output, nil
}

// Override the generated data from the overrides in the config
// This is an experimental feature until Gitpod Dedicated is in GA
func Override(overrideCfg *[]experimental.Overrides, objects []common.RuntimeObject) ([]common.RuntimeObject, error) {
	if overrideCfg != nil && len(*overrideCfg) > 0 {
		overrides := make(map[string]experimental.Overrides)

		for _, component := range *overrideCfg {
			key := generateOverrideKey(component.APIVersion, component.Kind, component.Metadata.GetName())

			overrides[key] = component
		}

		for k, v := range objects {
			key := generateOverrideKey(v.APIVersion, v.Kind, v.Metadata.GetName())

			if override, ok := overrides[key]; ok {
				// Marshal the override data to raw YAML
				data, err := yaml.Marshal(override.Override)
				if err != nil {
					return nil, err
				}

				if err != nil {
					return nil, err
				}

				// Merge the two YAML objects
				content, err := Merge(v.Content, string(data))
				if err != nil {
					return nil, err
				}

				// Update the output with the overriden YAML
				objects[k].Content = *content
			}
		}
	}

	return objects, nil
}
