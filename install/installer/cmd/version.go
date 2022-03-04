// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"debug/elf"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"sigs.k8s.io/yaml"

	"github.com/spf13/cobra"
)

// versionCmd represents the version command
var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Display the version information",
	RunE: func(cmd *cobra.Command, args []string) error {
		versionMF, err := getVersionManifest()
		if err != nil {
			return err
		}

		versions, err := common.ToJSONString(versionMF)
		if err != nil {
			return err
		}

		fmt.Println(string(versions))

		return nil
	},
}

func getVersionManifest() (*versions.Manifest, error) {
	embeddedManifest, err := versions.Embedded()
	if err != nil {
		return nil, err
	}
	if embeddedManifest != nil {
		return embeddedManifest, nil
	}

	var data []byte
	if rootOpts.VersionMF != "" {
		var err error
		data, err = ioutil.ReadFile(rootOpts.VersionMF)
		if err != nil {
			return nil, err
		}
	} else {
		selfPath, err := os.Executable()
		if err != nil {
			return nil, err
		}
		selfFile, err := os.Open(selfPath)
		if err != nil {
			return nil, err
		}
		selfElf, err := elf.NewFile(selfFile)
		if err != nil {
			return nil, err
		}
		for _, s := range selfElf.Sections {
			if s.Name == "versionManifest" {
				data, _ = s.Data()
			}
		}

	}

	var res versions.Manifest
	err = yaml.Unmarshal(data, &res)
	if err != nil {
		return nil, err
	}

	return &res, nil
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
