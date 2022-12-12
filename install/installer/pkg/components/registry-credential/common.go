// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry_credential

import (
	"regexp"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/utils/pointer"
)

// isAWSRegistry checks the external container registry URL is a private AWS ECR container registry.
func isAWSRegistry(ctx *common.RenderContext) bool {
	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) &&
		ctx.Config.ContainerRegistry.External != nil {
		// We support private AWS ECR container registry now.
		re := regexp.MustCompile(`^\d{12}\.dkr\.ecr\.[a-z]{2}-[a-z]+-\d\.amazonaws\.com$`)
		return re.MatchString(ctx.Config.ContainerRegistry.External.URL)
	}
	return false
}

// TODO(jenting): parse the AWS region from the container registry URL
func getAWSRegion(url string) string {
	return "us-west-1"
}
