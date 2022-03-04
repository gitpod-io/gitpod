// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"os"

	"github.com/32leaves/bel"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
	"github.com/iancoleman/strcase"
)

func main() {
	ts, err := bel.Extract((*theialib.TheiaCLIService)(nil),
		bel.FollowStructs,
		bel.SortAlphabetically,
	)
	if err != nil {
		panic(err)
	}

	for _, tp := range ts {
		if tp.Name != "TheiaCLIService" {
			continue
		}

		for i := range tp.Members {
			tp.Members[i].Name = strcase.ToLowerCamel(tp.Members[i].Name)
			tp.Members[i].Type.Name = fmt.Sprintf("Promise<%s>", tp.Members[i].Type.Name)
		}

		break
	}

	out := os.Stdout
	if len(os.Args) > 1 {
		f, err := os.OpenFile(os.Args[1], os.O_WRONLY|os.O_CREATE, 0644)
		if err != nil {
			panic(err)
		}
		defer f.Close()
		out = f
	}

	err = bel.Render(ts,
		bel.GenerateAdditionalPreamble("\n// re-generate using `cd devops/images/workspace-image-builder/gitpod-cli && go generate ./...`\n"),
		bel.GenerateAdditionalPreamble("\nexport const TheiaCLIService = Symbol('TheiaCLIService');\n"),
		bel.GenerateAdditionalPreamble("export const SERVICE_PATH = '/services/cli';\n"),
		bel.GenerateOutputTo(out),
	)
	if err != nil {
		panic(err)
	}
}
