// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package charts

import (
	"embed"
)

// Imported from https://github.com/cilium/tetragon/tree/main/install/kubernetes

//go:embed tetragon/*
var tetragon embed.FS

func Tetragon() *Chart {
	return &Chart{
		Name:     "Tetragon",
		Location: "tetragon/",
		Content:  &tetragon,
	}
}
