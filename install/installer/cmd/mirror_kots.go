// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"io/ioutil"

	kots "github.com/replicatedhq/kots/kotskinds/apis/kots/v1beta1"
	"github.com/spf13/cobra"
	"sigs.k8s.io/yaml"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	//nolint:typecheck
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
)

var mirrorKotsOpts struct {
	File string
}

// mirrorKotsCmd represents the mirror kots command
var mirrorKotsCmd = &cobra.Command{
	Use:   "kots",
	Short: "Renders a list of images used to the KOTS app file",
	Long: `Renders a list of images used to the KOTS app file

The KOTS application file allows an optional array of strings that
reference images. These are used to build the air gap bundle and are
pushed to the local registry during installation.

KOTS documentation:
https://docs.replicated.com/reference/custom-resource-application#additionalimages`,
	Example: "gitpod-installer mirror kots --file ../kots/manifests/kots-app.yaml",
	RunE: func(cmd *cobra.Command, args []string) error {
		// Build a virtual config file
		rawCfg, cfgVersion, err := config.Load("", rootOpts.StrictConfigParse)
		if err != nil {
			return err
		}
		cfg := rawCfg.(*configv1.Config)

		if mirrorKotsOpts.File == "" {
			return fmt.Errorf("kots file must be defined")
		}

		kotsBytes, err := ioutil.ReadFile(mirrorKotsOpts.File)
		if err != nil {
			panic(fmt.Sprintf("couldn't read file %s, %s", mirrorKotsOpts.File, err))
		}

		var kotsApp kots.Application
		err = yaml.Unmarshal(kotsBytes, &kotsApp)
		if err != nil {
			return err
		}

		// Fake the required config data
		cfg.Domain = "gitpod.io"
		cfg.Repository = "custom-repo-name"

		images, err := generateMirrorList(cfgVersion, cfg)
		if err != nil {
			return err
		}

		// Only append images - this will keep any existing images in the spec
		for _, img := range images {
			kotsApp.Spec.AdditionalImages = append(kotsApp.Spec.AdditionalImages, img.Original)
		}

		fc, err := yaml.Marshal(kotsApp)
		if err != nil {
			return err
		}

		err = ioutil.WriteFile(mirrorKotsOpts.File, fc, 0644)
		if err != nil {
			return err
		}

		fmt.Println("Gitpod images written to " + mirrorKotsOpts.File)

		return nil
	},
}

func init() {
	mirrorCmd.AddCommand(mirrorKotsCmd)

	mirrorKotsCmd.Flags().StringVarP(&mirrorKotsOpts.File, "file", "f", "", "path to the kots app file")
}
