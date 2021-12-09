// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"

	"github.com/docker/distribution/reference"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/spf13/cobra"
)

type mirrorListRepo struct {
	Original string `json:"original"`
	Target   string `json:"target"`
}

var mirrorListOpts struct {
	ConfigFN          string
	ExcludeThirdParty bool
}

// mirrorListCmd represents the mirror list command
var mirrorListCmd = &cobra.Command{
	Use:   "list",
	Short: "Renders a list of images used so they can be mirrored to a third-party registry",
	Long: `Renders a list of images used so they can be mirrored to a third-party registry

A config file is required which can be generated with the init command.
The "repository" field must be set to your container repository server
address and this value will be used to generate the mirrored image names
and tags.

The output can then be used to iterate over each image. A script can
be written to pull from the "original" path and then tag and push the
image to the "target" repo`,
	Example: `
  gitpod-installer mirror list --config config.yaml > mirror.json

  # Pull original and push to target
  for row in $(gitpod-installer mirror list --config ./config.yaml | jq -c '.[]'); do
    original=$(echo $row | jq -r '.original')
    target=$(echo $row | jq -r '.target')
    docker pull $original
    docker tag $original $target
    docker push $target
  done`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if mirrorListOpts.ConfigFN == "" {
			return fmt.Errorf("config is a required flag")
		}

		_, cfgVersion, cfg, err := loadConfig(mirrorListOpts.ConfigFN)
		if err != nil {
			return err
		}

		// Throw error if set to the default Gitpod repository
		if cfg.Repository == common.GitpodContainerRegistry {
			return fmt.Errorf("cannot mirror images to repository %s", common.GitpodContainerRegistry)
		}

		// Get the target repository from the config
		targetRepo := strings.TrimRight(cfg.Repository, "/")

		// Use the default Gitpod registry to pull from
		cfg.Repository = common.GitpodContainerRegistry

		k8s, err := renderKubernetesObjects(cfgVersion, cfg)
		if err != nil {
			return err
		}

		// Map of images used for deduping
		allImages := make(map[string]bool)

		rawImages := make([]string, 0)
		for _, item := range k8s {
			rawImages = append(rawImages, getPodImages(item)...)
			rawImages = append(rawImages, getGenericImages(item)...)
		}

		images := make([]mirrorListRepo, 0)
		for _, img := range rawImages {
			// Dedupe
			if _, ok := allImages[img]; ok {
				continue
			}
			allImages[img] = true

			// Convert target
			target := img
			if strings.Contains(img, cfg.Repository) {
				// This is the Gitpod registry
				target = strings.Replace(target, cfg.Repository, targetRepo, 1)
			} else if !mirrorListOpts.ExcludeThirdParty {
				// Amend third-party images - remove the first part
				thirdPartyImg := strings.Join(strings.Split(img, "/")[1:], "/")
				target = fmt.Sprintf("%s/%s", targetRepo, thirdPartyImg)
			} else {
				// Excluding third-party images - just skip this one
				continue
			}

			images = append(images, mirrorListRepo{
				Original: img,
				Target:   target,
			})
		}

		// Sort it by the Original
		sort.Slice(images, func(i, j int) bool {
			scoreI := images[i].Original
			scoreJ := images[j].Original

			return scoreI < scoreJ
		})

		fc, err := json.MarshalIndent(images, "", "  ")
		if err != nil {
			return err
		}

		fmt.Println(string(fc))

		return nil
	},
}

func init() {
	mirrorCmd.AddCommand(mirrorListCmd)

	mirrorListCmd.Flags().BoolVar(&mirrorListOpts.ExcludeThirdParty, "exclude-third-party", false, "exclude non-Gitpod images")
	mirrorListCmd.Flags().StringVarP(&mirrorListOpts.ConfigFN, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "path to the config file")
}

// getGenericImages this is a bit brute force - anything starting "docker.io" or with Gitpod repo is found
// this will be in ConfigMaps and could be anything, so will need cleaning up
func getGenericImages(k8sObj string) []string {
	var images []string

	// Search for anything that matches docker.io or the Gitpod repo - docker.io needed for gitpod/workspace-full
	re := regexp.MustCompile(fmt.Sprintf("%s(.*)|%s(.*)", "docker.io", common.GitpodContainerRegistry))
	img := re.FindAllString(k8sObj, -1)

	if len(img) > 0 {
		for _, i := range img {
			// Remove whitespace
			i = strings.TrimSpace(i)
			// Remove end commas
			i = strings.TrimRight(i, ",")
			// Remove wrapping quotes
			i = strings.Trim(i, "\"")
			// Validate the image - assumes images are already fully qualified names
			_, err := reference.ParseNamed(i)
			if err != nil {
				// Invalid - ignore
				continue
			}

			images = append(images, i)
		}
	}

	return images
}

// getPodImages these are images that are found in the "image:" tag in a PodSpec
// may be multiple tags in a file
func getPodImages(k8sObj string) []string {
	var images []string

	re := regexp.MustCompile("image:(.*)")
	img := re.FindAllString(k8sObj, -1)

	if len(img) > 0 {
		for _, i := range img {
			// Remove "image":
			i = re.ReplaceAllString(i, "$1")
			// Remove whitespace
			i = strings.TrimSpace(i)
			// Remove wrapping quotes
			i = strings.Trim(i, "\"")

			images = append(images, i)
		}
	}

	return images
}
