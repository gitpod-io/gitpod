// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package preview

import (
	"context"
	"fmt"
	"time"
)

type Status struct {
	Name   string
	Active bool
	Reason string
}

var (
	HOURS_UNTIL_STALE = 48
)

func (c *Config) GetStatus(ctx context.Context) (Status, error) {
	// If the VM got created in the last 120 mins, always assume it's active
	// clock skew can go to hell
	c.ensureCreationTime()

	if c.creationTime == nil {
		c.status.Active = true
		c.status.Reason = "Failed to find creation time, assuming active"
		return c.status, nil
	}

	if c.creationTime.After(time.Now().Add(-time.Duration(HOURS_UNTIL_STALE) * time.Hour)) {
		c.status.Active = true
		c.status.Reason = fmt.Sprintf("VM created in the past %d hours, assuming active: [%v]", HOURS_UNTIL_STALE, c.creationTime)
		return c.status, nil
	}

	c.status.Active = false
	c.status.Reason = fmt.Sprintf("VM has existed for more than %d hours, assuming stale: [%v]", HOURS_UNTIL_STALE, c.creationTime)
	return c.status, nil
}
