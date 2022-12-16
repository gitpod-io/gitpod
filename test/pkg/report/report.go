// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package report

import "testing"

func SetupReport(t *testing.T, feat Feature, desc string) {
	// Output the feature type of this test for the Quality Assurance Report
	t.Log(feat)
	// Output the description of this test for the Quality Assurance Report
	t.Log(desc)
}
