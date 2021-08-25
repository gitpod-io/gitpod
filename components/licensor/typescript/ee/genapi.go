// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

//go:build genapi
// +build genapi

package main

import (
	"os"
	"sort"

	"github.com/32leaves/bel"

	"github.com/gitpod-io/gitpod/licensor/ee/pkg/licensor"
)

const (
	defaultSrcPath = "../../ee/pkg/licensor"
	leewaySrcPath  = "../components-licensor--lib/ee/pkg/licensor"

	preamble = `/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

// generated using github.com/32leaves/bel
// DO NOT MODIFY`
)

func main() {
	var pth = defaultSrcPath
	if _, err := os.Stat(leewaySrcPath); err == nil {
		pth = leewaySrcPath
	}

	var res []bel.TypescriptType
	handler, err := bel.NewParsedSourceEnumHandler(pth)
	if err != nil {
		panic(err)
	}
	ts, err := bel.Extract(struct {
		Feature licensor.Feature
	}{}, bel.WithEnumerations(handler))
	if err != nil {
		panic(err)
	}
	for _, t := range ts {
		if t.Name == "" {
			continue
		}
		res = append(res, t)
	}

	ts, err = bel.Extract(licensor.LicensePayload{}, bel.WithEnumerations(handler))
	if err != nil {
		panic(err)
	}
	for _, t := range ts {
		if t.Name == "" {
			continue
		}

		if t.Name == "LicensePayload" {
			for i, m := range t.Members {
				if m.Name == "validUntil" {
					t.Members[i].Type.Name = "string"
				}
			}
		}

		res = append(res, t)
	}

	sort.Slice(res, func(i, j int) bool { return res[i].Name < res[j].Name })

	f, err := os.Create("src/api.ts")
	if err != nil {
		panic(err)
	}
	defer f.Close()
	bel.Render(res,
		bel.GenerateOutputTo(f),
		bel.GeneratePreamble(preamble),
	)
}
