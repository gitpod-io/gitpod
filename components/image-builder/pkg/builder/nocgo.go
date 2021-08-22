// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build cgo
// +build cgo

package builder

func init() {
	// panic("CGO must be disabled - use CGO_ENABLED=0 while building")
}

// THIS FILE SHOULD NOT COMPILE IF CGO_ENABLED=1 which is the default.
// Unfortunately there's no good way to make the go compiler fail explicitely.
// If you're here because your stuff failed to run or compile, make sure you have CGO_ENABLED=0 in your environment.
