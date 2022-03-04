// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package hosts

// NewFixedIPSource creates a new fixed IP source
func NewFixedIPSource(alias string, hosts []Host) *FixedIPSource {
	return &FixedIPSource{
		Alias: alias,
		Hosts: hosts,
		c:     make(chan []Host),
	}
}

// FixedIPSource is a Host source that's fixed at configuration time
type FixedIPSource struct {
	Alias string
	Hosts []Host

	c chan []Host
}

// Name returns the ID of this source
func (fi FixedIPSource) Name() string {
	return fi.Alias
}

// Start starts the source
func (fi FixedIPSource) Start() error {
	fi.c <- fi.Hosts
	return nil
}

// Source provides hosts on the channel
func (fi FixedIPSource) Source() <-chan []Host {
	return fi.c
}

// Stop stops this source from providing hosts
func (fi FixedIPSource) Stop() {}
