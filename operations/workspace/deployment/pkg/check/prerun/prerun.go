// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package prerun

// PreRun is an interface that should be implemented by all preruns checks
type PreRun interface {
	Run() error
}
