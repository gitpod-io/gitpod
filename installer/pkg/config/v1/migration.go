// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	configv0 "github.com/gitpod-io/gitpod/installer/pkg/config/v0"
)

func init() {
	config.AddMigration("v0", "v1", migrateV0toV1)
}

func migrateV0toV1(old, new interface{}) error {
	v0cfg := old.(*configv0.Config)
	v1cfg := new.(*Config)

	if v0cfg.Analytics != nil {
		v1cfg.Analytics = &Analytics{
			SegmentKey: v0cfg.Analytics.SegmentKey,
			Writer:     v0cfg.Analytics.Writer,
		}
	}

	return nil
}
