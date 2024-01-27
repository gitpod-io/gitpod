// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

func TestAnalyzeGitpodConfig(t *testing.T) {
	tests := []struct {
		Desc    string
		Prev    *gitpod.GitpodConfig
		Current *gitpod.GitpodConfig
		Fields  []string
	}{
		{
			Desc: "change",
			Prev: &gitpod.GitpodConfig{
				CheckoutLocation: "foo",
			},
			Current: &gitpod.GitpodConfig{
				CheckoutLocation: "bar",
			},
			Fields: []string{"CheckoutLocation"},
		},
		{
			Desc: "add",
			Prev: &gitpod.GitpodConfig{},
			Current: &gitpod.GitpodConfig{
				CheckoutLocation: "bar",
			},
			Fields: []string{"CheckoutLocation"},
		},
		{
			Desc: "remove",
			Prev: &gitpod.GitpodConfig{
				CheckoutLocation: "bar",
			},
			Current: &gitpod.GitpodConfig{},
			Fields:  []string{"CheckoutLocation"},
		},
		{
			Desc: "none",
			Prev: &gitpod.GitpodConfig{
				CheckoutLocation: "bar",
			},
			Current: &gitpod.GitpodConfig{
				CheckoutLocation: "bar",
			},
			Fields: nil,
		},
		{
			Desc:    "fie created",
			Current: &gitpod.GitpodConfig{},
			Fields:  nil,
		},
	}
	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			var fields []string
			analyzer := NewConfigAnalyzer(log.Log, 100*time.Millisecond, func(field string) {
				fields = append(fields, field)
			}, test.Prev)
			<-analyzer.Analyse(test.Current)
			if diff := cmp.Diff(test.Fields, fields); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}
}
