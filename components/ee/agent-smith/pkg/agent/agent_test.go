// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path"
	"reflect"
	"sort"
	"testing"
	"time"

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
	rb := config.EnforcementRules{config.GradeKind(config.InfringementExcessiveEgress, common.SeverityAudit): config.PenaltyLimitCPU}
	tests := []struct {
		Desc        string
		Rules       map[string]config.EnforcementRules
		RemoteURL   string
		Expectation config.EnforcementRules
	}{
		{"direct match", map[string]config.EnforcementRules{"foo": ra, "bar": rb}, "foo", ra},
		{"no match", map[string]config.EnforcementRules{"foo*": ra, "bar": rb}, "not found", nil},
		{"star", map[string]config.EnforcementRules{"foo*": ra, "bar": rb}, "foobar", ra},
		{"prefix match", map[string]config.EnforcementRules{"*foo": ra, "bar": rb}, "hello/foo", ra},
		{"suffix match", map[string]config.EnforcementRules{"foo*": ra, "bar": rb}, "foobar", ra},
		{"case-insensitive match", map[string]config.EnforcementRules{"foo*": ra, "bar": rb}, "Foobar", ra},
		{"submatch", map[string]config.EnforcementRules{"*foo*": ra, "bar": rb}, "hello/foo/bar", ra},
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

func TestCeckEgressTrafficCallback(t *testing.T) {
	simpleTime, _ := time.Parse(time.RFC3339, "2021-07-05T15:16:17+02:00")

	type args struct {
		pid             int
		pidCreationTime time.Time
	}
	tests := map[string]struct {
		args                      args
		want                      *Infringement
		egressTrafficCheckHandler func(pid int) (int64, error)
		timeElapsedHandler        func(t time.Time) time.Duration
		wantErr                   bool
	}{
		"no_infringement": {
			args: args{
				pid:             1234,
				pidCreationTime: simpleTime,
			},
			want: nil,
			egressTrafficCheckHandler: func(pid int) (int64, error) {
				return 2000000, nil
			},
			timeElapsedHandler: func(t time.Time) time.Duration {
				d, _ := time.ParseDuration("1m")
				return d
			},
			wantErr: false,
		},
		"zero_egress": {
			args: args{
				pid:             1234,
				pidCreationTime: simpleTime,
			},
			want: nil,
			egressTrafficCheckHandler: func(pid int) (int64, error) {
				return 0, nil
			},
			timeElapsedHandler: func(t time.Time) time.Duration {
				d, _ := time.ParseDuration("1m")
				return d
			},
			wantErr: false,
		},
		"excessive_egress": {
			args: args{
				pid:             1234,
				pidCreationTime: simpleTime,
			},
			want: &Infringement{
				Kind:        config.GradedInfringementKind(config.InfringementExcessiveEgress),
				Description: "egress traffic is 12.805 megabytes over limit",
			},
			egressTrafficCheckHandler: func(pid int) (int64, error) {
				return 328000000, nil
			},
			timeElapsedHandler: func(t time.Time) time.Duration {
				d, _ := time.ParseDuration("1m")
				return d
			},
			wantErr: false,
		},
		"very_excessive_egress_simple": {
			args: args{
				pid:             1234,
				pidCreationTime: simpleTime,
			},
			want: &Infringement{
				Kind:        config.GradeKind(config.InfringementExcessiveEgress, common.SeverityVery),
				Description: "egress traffic is 188686.863 megabytes over limit",
			},
			egressTrafficCheckHandler: func(pid int) (int64, error) {
				return 200000000000, nil
			},
			timeElapsedHandler: func(t time.Time) time.Duration {
				d, _ := time.ParseDuration("1s")
				return d
			},
			wantErr: false,
		},
		"very_excessive_egress": {
			args: args{
				pid:             1234,
				pidCreationTime: simpleTime,
			},
			want: &Infringement{
				Kind:        config.GradeKind(config.InfringementExcessiveEgress, common.SeverityVery),
				Description: "egress traffic is 188686.863 megabytes over limit",
			},
			egressTrafficCheckHandler: func(pid int) (int64, error) {
				return 200000000000, nil
			},
			timeElapsedHandler: func(t time.Time) time.Duration {
				d, _ := time.ParseDuration("1m")
				return d
			},
			wantErr: false,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			fc, err := ioutil.ReadFile(path.Join("testdata", fmt.Sprintf("agent_check_egress_%s.golden", name)))
			if err != nil {
				t.Errorf("cannot read config: %v", err)
				return
			}
			var cfg config.Config
			err = json.Unmarshal(fc, &cfg)
			if err != nil {
				t.Errorf("cannot unmarshal config: %v", err)
				return
			}
			agent, err := NewAgentSmith(cfg)
			if err != nil {
				t.Errorf("cannot create test agent smith from config: %v", err)
				return
			}
			agent.egressTrafficCheckHandler = tt.egressTrafficCheckHandler
			agent.timeElapsedHandler = tt.timeElapsedHandler
			got, err := agent.checkEgressTrafficCallback(tt.args.pid, tt.args.pidCreationTime)
			if (err != nil) != tt.wantErr {
				t.Errorf("Smith.checkEgressTrafficCallback() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("Smith.checkEgressTrafficCallback() = %s", cmp.Diff(got, tt.want))
			}
		})
	}
}
