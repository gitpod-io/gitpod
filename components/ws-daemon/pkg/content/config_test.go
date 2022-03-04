// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content_test

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/google/go-cmp/cmp"
)

func TestFSShiftMethodUnmarshalJSON(t *testing.T) {
	tests := []struct {
		Input       string
		Expectation content.FSShiftMethod
	}{
		{"shiftfs", content.FSShiftMethod(api.FSShiftMethod_SHIFTFS)},
		{"fuse", content.FSShiftMethod(api.FSShiftMethod_FUSE)},
	}

	for _, test := range tests {
		t.Run(test.Input, func(t *testing.T) {
			var act struct {
				M content.FSShiftMethod
			}
			err := json.Unmarshal([]byte(fmt.Sprintf("{\"M\":\"%s\"}", test.Input)), &act)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(test.Expectation, act.M); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
