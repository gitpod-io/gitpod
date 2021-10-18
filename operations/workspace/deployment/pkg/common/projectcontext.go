// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

// ProjectContext is a wrapper which contains information required to communicate to the
// right GCP project with correct inputs
type ProjectContext struct {
	ID          string
	Environment Environment
}
