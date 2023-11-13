// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package constants

import (
	_ "embed"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	version "github.com/gitpod-io/local-app"
)

var (
	// Version is fed from the main CLI version
	Version = semver.MustParse(strings.TrimSpace(version.Version))

	// GitCommit - set during build
	GitCommit = "unknown"

	// BuildTime - set during build
	BuildTime = "unknown"
)

// MustParseBuildTime parses the build time or panics
func MustParseBuildTime() time.Time {
	if BuildTime == "unknown" {
		return time.Time{}
	}

	sec, err := strconv.ParseInt(BuildTime, 10, 64)
	if err != nil {
		panic(fmt.Sprintf("cannot parse build time: %v", err))
	}
	return time.Unix(sec, 0)
}
