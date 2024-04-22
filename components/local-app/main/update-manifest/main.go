// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/Masterminds/semver/v3"
	"github.com/gitpod-io/local-app/pkg/constants"
	"github.com/gitpod-io/local-app/pkg/selfupdate"
	"github.com/sagikazarmark/slog-shim"
	"github.com/spf13/pflag"
)

var (
	version = pflag.String("version", constants.Version.String(), "version to use")
	cwd     = pflag.String("cwd", ".", "working directory")
)

func main() {
	pflag.Parse()

	ver := semver.MustParse(*version)
	mf, err := selfupdate.GenerateManifest(ver, *cwd, selfupdate.DefaultFilenameParser)
	if err != nil {
		slog.Error("cannot generate manifest", "err", err)
		os.Exit(1)
	}
	fc, err := json.MarshalIndent(mf, "", "  ")
	if err != nil {
		slog.Error("cannot marshal manifest", "err", err)
		os.Exit(1)
	}
	fmt.Println(string(fc))
}
