// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build tools
// +build tools

// helper to avoid adding/removing dependencies required by grpc but not by the module itself
package api

import (
	_ "github.com/fatih/gomodifytags"
)
