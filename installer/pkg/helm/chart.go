// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package helm

import (
	_ "embed"
)

//go:embed chart/Chart.yaml
var gitpodChart []byte

//go:embed chart/values.yaml
var gitpodValues []byte
