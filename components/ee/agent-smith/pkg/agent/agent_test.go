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
				Kind:        GradedInfringementKind(InfringementExcessiveEgress),
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
				Kind:        GradedInfringementKind(InfringementVeryExcessiveEgress),
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
				Kind:        GradedInfringementKind(InfringementVeryExcessiveEgress),
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
			var cfg Config
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

func TestHandleExecveEventCallback(t *testing.T) {
	type args struct {
		execve *Execve
	}
	type want struct {
		infringingWs *InfringingWorkspace
		err          error
	}
	tests := map[string]struct {
		args args
		want want
	}{
		"blocked_raw_binary": {
			args: args{
				execve: &Execve{
					Filename: "/tmp/offending.rb",
					Argv:     []string{"arg1", "arg2"},
				},
			},
			want: want{
				infringingWs: &InfringingWorkspace{
					Infringements: []Infringement{
						{
							Description: fmt.Sprintf("user ran %s blacklisted command: %s %v", "", "/tmp/offending.rb", []string{"arg1", "arg2"}),
							Kind:        GradeKind(InfringementExecBlacklistedCmd, ""),
						},
					},
				},
				err: nil,
			},
		},
		"blocked_raw_binary_arg": {
			args: args{
				execve: &Execve{
					Filename: "/tmp/test.rb",
					Argv:     []string{"offending"},
				},
			},
			want: want{
				infringingWs: &InfringingWorkspace{
					Infringements: []Infringement{
						{
							Description: fmt.Sprintf("user ran %s blacklisted command: %s %v", "", "/tmp/test.rb", []string{"offending"}),
							Kind:        GradeKind(InfringementExecBlacklistedCmd, ""),
						},
					},
				},
				err: nil,
			},
		},
		"blocked_binary_allowlisted_via_path": {
			args: args{
				execve: &Execve{
					Filename: "User/Library/Allowed/path/git.MyAllowed/offending.rb",
					Argv:     []string{"test1", "test2"},
				},
			},
			want: want{
				infringingWs: nil,
				err:          nil,
			},
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			fc, err := ioutil.ReadFile(path.Join("testdata", "agent_check_binary_blocking.golden"))
			if err != nil {
				t.Errorf("cannot read config: %v", err)
				return
			}
			var cfg Config
			err = json.Unmarshal(fc, &cfg)
			if err != nil {
				t.Errorf("cannot unmarshal config: %v", err)
				return
			}
			agent, err := NewAgentSmith(cfg)
			if err != nil {
				t.Errorf("cannot create test agent smith from config: %v %v %v", err, agent, tt.args)
				return
			}
			fn := agent.handleExecveEvent(*tt.args.execve)
			gotInfringementWorkspaces, err := fn()
			if err != tt.want.err {
				t.Errorf("Smith.handleExecveEvent() error = %v, wantErr %v", err, tt.want.err)
				return
			}

			if !reflect.DeepEqual(gotInfringementWorkspaces, tt.want.infringingWs) {
				t.Errorf("Smith.handleExecveEvent() = %s", cmp.Diff(gotInfringementWorkspaces, tt.want))
			}
		})
	}
}
