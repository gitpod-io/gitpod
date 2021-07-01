// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestGetPenalty(t *testing.T) {
	tests := []struct {
		Desc         string
		Default      EnforcementRules
		Repo         EnforcementRules
		Infringement []Infringement
		Penalties    []PenaltyKind
	}{
		{
			Desc:         "audit only",
			Default:      EnforcementRules{GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit): PenaltyStopWorkspace},
			Infringement: []Infringement{{Kind: GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit)}},
			Penalties:    []PenaltyKind{PenaltyStopWorkspace},
		},
		{
			Desc:         "repo only",
			Repo:         EnforcementRules{GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit): PenaltyStopWorkspace},
			Infringement: []Infringement{{Kind: GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit)}},
			Penalties:    []PenaltyKind{PenaltyStopWorkspace},
		},
		{
			Desc:         "repo override",
			Default:      EnforcementRules{GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit): PenaltyStopWorkspace},
			Repo:         EnforcementRules{GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit): PenaltyNone},
			Infringement: []Infringement{{Kind: GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit)}},
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
	ra := EnforcementRules{GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit): PenaltyLimitCPU}
	rb := EnforcementRules{GradeKind(InfringementExcessiveEgress, InfringementSeverityAudit): PenaltyLimitCPU}
	tests := []struct {
		Desc        string
		Rules       map[string]EnforcementRules
		RemoteURL   string
		Expectation EnforcementRules
	}{
		{"direct match", map[string]EnforcementRules{"foo": ra, "bar": rb}, "foo", ra},
		{"no match", map[string]EnforcementRules{"foo*": ra, "bar": rb}, "not found", nil},
		{"star", map[string]EnforcementRules{"foo*": ra, "bar": rb}, "foobar", ra},
		{"prefix match", map[string]EnforcementRules{"*foo": ra, "bar": rb}, "hello/foo", ra},
		{"suffix match", map[string]EnforcementRules{"foo*": ra, "bar": rb}, "foobar", ra},
		{"case-insensitive match", map[string]EnforcementRules{"foo*": ra, "bar": rb}, "Foobar", ra},
		{"submatch", map[string]EnforcementRules{"*foo*": ra, "bar": rb}, "hello/foo/bar", ra},
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
	ra := EnforcementRules{GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit): PenaltyLimitCPU}
	rules := map[string]EnforcementRules{
		"*foo*": ra,
		"bar":   ra, "bar1": ra, "bar2": ra, "bar3": ra, "bar4": ra, "bar5": ra, "bar6": ra,
		"foo1*": ra, "foo2*": ra, "foo3*": ra, "foo4*": ra, "foo5*": ra, "foo6*": ra, "foo7*": ra,
	}

	for i := 0; i < b.N; i++ {
		findEnforcementRules(rules, "foobar")
	}
}
