// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package util_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/gitpod-io/gitpod/common-go/util"
)

func TestUnmarshalJSON(t *testing.T) {
	type carrier struct {
		T util.Duration `json:"t"`
	}

	tests := []struct {
		Input    string
		Expected *carrier
		Error    string
	}{
		{"{\"t\": \"10m\"}", &carrier{T: util.Duration(10 * time.Minute)}, ""},
		{"{\"t\": \"doesntParse\"}", nil, "time: invalid duration \"doesntParse\""},
	}

	for i, test := range tests {
		t.Run(fmt.Sprintf("%03d", i), func(t *testing.T) {
			var res carrier
			err := json.Unmarshal([]byte(test.Input), &res)
			if err != nil {
				msg := err.Error()
				if msg != test.Error {
					t.Errorf("unexpected error \"%s\": expected \"%s\"", msg, test.Error)
				}
				return
			} else if test.Error != "" {
				t.Errorf("expected error but saw none")
			}

			if diff := cmp.Diff(test.Expected, &res); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
