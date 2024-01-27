// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package report

type Feature string

const (
	FeatureExample       Feature = "example"
	FeatureResourceLimit Feature = "resource limit"
	FeatureContentInit   Feature = "content init"
	FeatureDocker        Feature = "docker"
	FeatureDotfiles      Feature = "dotfiles"
	FeatureMultiRepos    Feature = "multi repos"
	FeaturePrebuild      Feature = "prebuild"
)
