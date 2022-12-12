// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry_credential

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

// IsAWSECRURL parses the external container registry URL exists and then
// checks whether the external container registry URL is a AWS ECR container registry.
func IsAWSECRURL(ctx *common.RenderContext) bool {
	if ctx.Config.ContainerRegistry.External == nil {
		return false
	}
	return isAWSECRURL(ctx.Config.ContainerRegistry.External.URL)
}

// isAWSECRURL checks whether the URL is a AWS ECR URL or not.
func isAWSECRURL(URL string) bool {
	if isPrivateAWSECRURL(URL) || isPublicAWSECRURL(URL) {
		return true
	}
	return false
}

// isPrivateAWSECRURL check if it's a private AWS ECR URL.
// The private AWS ECR URL with the format aws_account_id.dkr.ecr.region.amazonaws.com.
func isPrivateAWSECRURL(URL string) bool {
	u, err := url.Parse(URL)
	if err != nil {
		log.WithError(err).Errorf("unable to parse url %s", URL)
		return false
	}

	host := u.Host
	if host == "" {
		host = URL
	}

	re, err := regexp.Compile(`^[0-9]+\.dkr\.ecr\.[a-z]+-[a-z]+-[0-9]+\.amazonaws\.com*`)
	if err != nil {
		log.WithError(err).Fatal("invalid private regexp pattern")
		return false
	}
	return re.MatchString(host)
}

// isPublicAWSECRURL check if it's a public AWS ECR URL.
// The public AWS ECR URL with the format public.ecr.aws/<registry-alias>.
func isPublicAWSECRURL(URL string) bool {
	u, err := url.Parse(URL)
	if err != nil {
		log.WithError(err).Errorf("unable to parse url %s", URL)
		return false
	}

	host := u.Host
	if host == "" {
		host = URL
	}

	re, err := regexp.Compile(`^public\.ecr\.aws*`)
	if err != nil {
		log.WithError(err).Fatal("invalid public regexp pattern")
		return false
	}
	return re.MatchString(host)
}

// getAWSRegion returns the AWS region according to the container registry URL.
func getAWSRegion(url string) string {
	if isPrivateAWSECRURL(url) {
		return strings.Split(url, ".")[3]
	}
	if isPublicAWSECRURL(url) {
		// If it's a public registry, force to use us-east-1 region
		// https://docs.aws.amazon.com/general/latest/gr/ecr-public.html#ecr-public-region
		return "us-east-1"
	}
	return ""
}
