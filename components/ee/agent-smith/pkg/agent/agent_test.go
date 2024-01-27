// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package agent

import (
	"sort"
	"testing"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/google/go-cmp/cmp"
)

func TestGetPenalty(t *testing.T) {
	tests := []struct {
		Desc         string
		Default      config.EnforcementRules
		Repo         config.EnforcementRules
		Infringement []Infringement
		Penalties    []config.PenaltyKind
	}{
		{
			Desc:         "audit only",
			Default:      config.EnforcementRules{config.GradeKind(config.InfringementExec, common.SeverityAudit): config.PenaltyStopWorkspace},
			Infringement: []Infringement{{Kind: config.GradeKind(config.InfringementExec, common.SeverityAudit)}},
			Penalties:    []config.PenaltyKind{config.PenaltyStopWorkspace},
		},
		{
			Desc:         "repo only",
			Repo:         config.EnforcementRules{config.GradeKind(config.InfringementExec, common.SeverityAudit): config.PenaltyStopWorkspace},
			Infringement: []Infringement{{Kind: config.GradeKind(config.InfringementExec, common.SeverityAudit)}},
			Penalties:    []config.PenaltyKind{config.PenaltyStopWorkspace},
		},
		{
			Desc:         "repo override",
			Default:      config.EnforcementRules{config.GradeKind(config.InfringementExec, common.SeverityAudit): config.PenaltyStopWorkspace},
			Repo:         config.EnforcementRules{config.GradeKind(config.InfringementExec, common.SeverityAudit): config.PenaltyNone},
			Infringement: []Infringement{{Kind: config.GradeKind(config.InfringementExec, common.SeverityAudit)}},
			Penalties:    nil,
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			penalties := getPenalty(test.Default, test.Repo, test.Infringement)
			sort.Slice(penalties, func(i, j int) bool { return penalties[i] < penalties[j] })

			if diff := cmp.Diff(test.Penalties, penalties); diff != "" {
				t.Errorf("unexpected penalties (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFindEnforcementRules(t *testing.T) {
	ra := config.EnforcementRules{config.GradeKind(config.InfringementExec, common.SeverityAudit): config.PenaltyLimitCPU}
	tests := []struct {
		Desc        string
		Rules       map[string]config.EnforcementRules
		RemoteURL   string
		Expectation config.EnforcementRules
	}{
		{"direct match", map[string]config.EnforcementRules{"foo": ra}, "foo", ra},
		{"no match", map[string]config.EnforcementRules{"foo*": ra}, "not found", nil},
		{"star", map[string]config.EnforcementRules{"foo*": ra}, "foobar", ra},
		{"prefix match", map[string]config.EnforcementRules{"*foo": ra}, "hello/foo", ra},
		{"suffix match", map[string]config.EnforcementRules{"foo*": ra}, "foobar", ra},
		{"case-insensitive match", map[string]config.EnforcementRules{"foo*": ra}, "Foobar", ra},
		{"submatch", map[string]config.EnforcementRules{"*foo*": ra}, "hello/foo/bar", ra},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			res := findEnforcementRules(test.Rules, test.RemoteURL)

			if diff := cmp.Diff(test.Expectation, res); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func BenchmarkFindEnforcementRules(b *testing.B) {
	ra := config.EnforcementRules{config.GradeKind(config.InfringementExec, common.SeverityAudit): config.PenaltyLimitCPU}
	rules := map[string]config.EnforcementRules{
		"*foo*": ra,
		"bar":   ra, "bar1": ra, "bar2": ra, "bar3": ra, "bar4": ra, "bar5": ra, "bar6": ra,
		"foo1*": ra, "foo2*": ra, "foo3*": ra, "foo4*": ra, "foo5*": ra, "foo6*": ra, "foo7*": ra,
	}

	for i := 0; i < b.N; i++ {
		findEnforcementRules(rules, "foobar")
	}
}
