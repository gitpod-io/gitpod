// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

type Job interface {
	Run() error
}

type JobFunc func() error

func (f JobFunc) Run() error {
	return f()
}
