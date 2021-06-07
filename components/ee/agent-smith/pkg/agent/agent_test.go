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

// func TestCheckForSignature(t *testing.T) {
// 	sigs := []*signature.Signature{
// 		&signature.Signature{Name: "fssig", Domain: signature.DomainFileSystem, Kind: signature.ObjectAny, Filename: []string{"foo"}, Pattern: []byte(base64.StdEncoding.EncodeToString([]byte("foo")))},
// 		&signature.Signature{Name: "procsig", Domain: signature.DomainProcess, Kind: signature.ObjectAny, Pattern: []byte(base64.StdEncoding.EncodeToString([]byte("foo")))},
// 	}

// 	tests := []struct {
// 		Desc     string
// 		Opts     []NewAgentSmithOption
// 		Domain   signature.Domain
// 		Sigs     []*signature.Signature
// 		Mock     func(t *testing.T, m *sentinel.MockSentinelServer)
// 		Severity InfringementSeverity
// 		Res      *Infringement
// 	}{
// 		{
// 			Desc:   "filesystem domain",
// 			Domain: signature.DomainFileSystem,
// 			Sigs:   sigs,
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().FindSignature(gomock.Any(), gomock.Eq(&sentinel.FindSignatureRequest{
// 					Domain:    sentinel.FindSignatureDomain_Filesystem,
// 					Signature: sentinel.ConvertSignaturesToProtocol(sigs[0:1]),
// 				})).Return(&sentinel.FindSignatureResponse{}, nil).MinTimes(1)
// 			},
// 		},
// 		{
// 			Desc:   "process domain",
// 			Domain: signature.DomainProcess,
// 			Sigs:   sigs,
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().FindSignature(gomock.Any(), gomock.Eq(&sentinel.FindSignatureRequest{
// 					Domain:    sentinel.FindSignatureDomain_Process,
// 					Signature: sentinel.ConvertSignaturesToProtocol(sigs[1:2]),
// 				})).Return(&sentinel.FindSignatureResponse{}, nil).MinTimes(1)
// 			},
// 		},
// 		{
// 			Desc:   "returns infringement",
// 			Domain: signature.DomainProcess,
// 			Sigs:   sigs,
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().FindSignature(gomock.Any(), gomock.Any()).Return(&sentinel.FindSignatureResponse{
// 					Target:    "foobar",
// 					Signature: sentinel.ConvertSignaturesToProtocol(sigs)[1],
// 				}, nil).MinTimes(1)
// 			},
// 			Severity: InfringementSeverityVery,
// 			Res: &Infringement{
// 				Description: "user ran program matching procsig signature: foobar",
// 				Kind:        GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityVery),
// 			},
// 		},
// 	}
// 	for _, test := range tests {
// 		t.Run(test.Desc, func(t *testing.T) {
// 			agent, err := NewAgentSmith(fakek8s.NewSimpleClientset(), test.Opts...)
// 			if err != nil {
// 				t.Fatalf("cannot create test agent: %q", err)
// 			}

// 			ctrl := gomock.NewController(t)
// 			defer ctrl.Finish()

// 			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
// 			defer cancel()

// 			sensrv := sentinel.NewMockSentinelServer(ctrl)
// 			test.Mock(t, sensrv)
// 			conn, err := connectToMockSentinel(ctx, sensrv)
// 			if err != nil {
// 				t.Fatalf("cannot connect to mock sentinel: %q", err)
// 			}

// 			sen := sentinel.NewSentinelClient(conn)
// 			res, err := agent.checkForSignature(ctx, "foobar", sen, test.Severity, test.Domain, test.Sigs)
// 			if err != nil {
// 				t.Errorf("unexpected error: %q", err)
// 			}

// 			if diff := cmp.Diff(test.Res, res); diff != "" {
// 				t.Errorf("unexpected result (-want +got):\n%s", diff)
// 			}
// 		})
// 	}
// }

// func TestCheckEgressTraffic(t *testing.T) {
// 	egressSettings := &EgressTraffic{
// 		WindowDuration: util.Duration(2 * time.Minute),
// 		ExcessiveLevel: &PerLevelEgressTraffic{
// 			BaseBudget: resource.MustParse("500Mi"),
// 			Threshold:  resource.MustParse("100Mi"),
// 		},
// 		VeryExcessiveLevel: &PerLevelEgressTraffic{
// 			BaseBudget: resource.MustParse("1Gi"),
// 			Threshold:  resource.MustParse("100Mi"),
// 		},
// 	}
// 	var (
// 		excessiveLevel     = resource.MustParse("800Mi")
// 		veryExcessiveLevel = resource.MustParse("1200Mi")
// 	)

// 	tests := []struct {
// 		Desc        string
// 		Opts        []NewAgentSmithOption
// 		PodLifetime time.Duration
// 		Mock        func(t *testing.T, m *sentinel.MockSentinelServer)
// 		Res         *Infringement
// 	}{
// 		{
// 			Desc:        "no infringement",
// 			Opts:        []NewAgentSmithOption{WithEgressTraffic(egressSettings)},
// 			PodLifetime: 1 * time.Minute,
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().GetEgressTraffic(gomock.Any(), gomock.Any()).Return(&sentinel.GetEgressTrafficResponse{
// 					TotalBytes: 1,
// 				}, nil).MinTimes(1)
// 			},
// 		},
// 		{
// 			Desc:        "excessive",
// 			Opts:        []NewAgentSmithOption{WithEgressTraffic(egressSettings)},
// 			PodLifetime: 1 * time.Minute,
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().GetEgressTraffic(gomock.Any(), gomock.Any()).Return(&sentinel.GetEgressTrafficResponse{
// 					TotalBytes: excessiveLevel.Value(),
// 				}, nil).MinTimes(1)
// 			},
// 			Res: &Infringement{
// 				Description: "egress traffic is 300.000 megabytes over limit",
// 				Kind:        GradeKind(InfringementExcessiveEgress, InfringementSeverityAudit),
// 			},
// 		},
// 		{
// 			Desc:        "very excessive",
// 			Opts:        []NewAgentSmithOption{WithEgressTraffic(egressSettings)},
// 			PodLifetime: 1 * time.Minute,
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().GetEgressTraffic(gomock.Any(), gomock.Any()).Return(&sentinel.GetEgressTrafficResponse{
// 					TotalBytes: veryExcessiveLevel.Value(),
// 				}, nil).MinTimes(1)
// 			},
// 			Res: &Infringement{
// 				Description: "egress traffic is 176.000 megabytes over limit",
// 				Kind:        GradeKind(InfringementExcessiveEgress, InfringementSeverityVery),
// 			},
// 		},
// 	}
// 	for _, test := range tests {
// 		t.Run(test.Desc, func(t *testing.T) {
// 			agent, err := NewAgentSmith(fakek8s.NewSimpleClientset(), test.Opts...)
// 			if err != nil {
// 				t.Fatalf("cannot create test agent: %q", err)
// 			}

// 			ctrl := gomock.NewController(t)
// 			defer ctrl.Finish()

// 			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
// 			defer cancel()

// 			sensrv := sentinel.NewMockSentinelServer(ctrl)
// 			test.Mock(t, sensrv)
// 			conn, err := connectToMockSentinel(ctx, sensrv)
// 			if err != nil {
// 				t.Fatalf("cannot connect to mock sentinel: %q", err)
// 			}

// 			sen := sentinel.NewSentinelClient(conn)
// 			res, err := agent.checkEgressTraffic(ctx, &corev1.Pod{ObjectMeta: metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(time.Now().Add(-test.PodLifetime))}}, sen)
// 			if err != nil {
// 				t.Errorf("unexpected error: %q", err)
// 			}
// 			if diff := cmp.Diff(test.Res, res); diff != "" {
// 				t.Errorf("unexpected result (-want +got):\n%s", diff)
// 			}
// 		})
// 	}
// }

// func TestCheckCPUUse(t *testing.T) {
// 	tests := []struct {
// 		Desc        string
// 		Opts        []NewAgentSmithOption
// 		PodLifetime time.Duration
// 		Mock        func(t *testing.T, m *sentinel.MockSentinelServer)
// 		Res         *Infringement
// 	}{
// 		{
// 			Desc: "no infringement",
// 			Opts: []NewAgentSmithOption{WithCPUUseCheck(4.5, 2)},
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().GetCPUInfo(gomock.Any(), gomock.Any()).Return(&sentinel.GetCPUInfoResponse{
// 					Load:       3,
// 					TopCommand: "none",
// 				}, nil).MinTimes(1)
// 			},
// 		},
// 		{
// 			Desc: "infringement",
// 			Opts: []NewAgentSmithOption{WithCPUUseCheck(4.5, 2)},
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().GetCPUInfo(gomock.Any(), gomock.Any()).Return(&sentinel.GetCPUInfoResponse{
// 					Load:       5,
// 					TopCommand: "evil-process",
// 				}, nil).MinTimes(1)
// 			},
// 			Res: &Infringement{
// 				Description: "CPU load 5.00 > 4.50 for 2 minutes. Top command is evil-process",
// 				Kind:        GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit),
// 			},
// 		},
// 	}
// 	for _, test := range tests {
// 		t.Run(test.Desc, func(t *testing.T) {
// 			agent, err := NewAgentSmith(fakek8s.NewSimpleClientset(), test.Opts...)
// 			if err != nil {
// 				t.Fatalf("cannot create test agent: %q", err)
// 			}

// 			ctrl := gomock.NewController(t)
// 			defer ctrl.Finish()

// 			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
// 			defer cancel()

// 			sensrv := sentinel.NewMockSentinelServer(ctrl)
// 			test.Mock(t, sensrv)
// 			conn, err := connectToMockSentinel(ctx, sensrv)
// 			if err != nil {
// 				t.Fatalf("cannot connect to mock sentinel: %q", err)
// 			}

// 			sen := sentinel.NewSentinelClient(conn)
// 			res, err := agent.checkForCPUUse(ctx, "foobar", sen)
// 			if err != nil {
// 				t.Errorf("unexpected error: %q", err)
// 			}
// 			if diff := cmp.Diff(test.Res, res); diff != "" {
// 				t.Errorf("unexpected result (-want +got):\n%s", diff)
// 			}
// 		})
// 	}
// }

// func TestBlacklistedCommand(t *testing.T) {
// 	binaries := func(p string) []string {
// 		return []string{p + "foo", p + "bar"}
// 	}
// 	blacklists := &Blacklists{
// 		Barely: &PerLevelBlacklist{Binaries: binaries("b_")},
// 		Audit:  &PerLevelBlacklist{Binaries: binaries("d_")},
// 		Very:   &PerLevelBlacklist{Binaries: binaries("v_")},
// 	}
// 	tests := []struct {
// 		Desc string
// 		Opts []NewAgentSmithOption
// 		Mock func(t *testing.T, m *sentinel.MockSentinelServer)
// 		Res  *Infringement
// 	}{
// 		{
// 			Desc: "no infringement",
// 			Opts: []NewAgentSmithOption{WithBlacklists(blacklists)},
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().IsCommandRunning(gomock.Any(), gomock.Any()).Return(&sentinel.IsCommandRunningRespose{}, nil).MinTimes(1)
// 			},
// 		},
// 		{
// 			Desc: "barely infringement",
// 			Opts: []NewAgentSmithOption{WithBlacklists(blacklists)},
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().IsCommandRunning(gomock.Any(), gomock.Eq(&sentinel.IsCommandRunningRequest{Command: binaries("b_")})).Return(&sentinel.IsCommandRunningRespose{
// 					Findings: binaries("b_"),
// 				}, nil).MinTimes(1)
// 				m.EXPECT().IsCommandRunning(gomock.Any(), gomock.Any()).Return(&sentinel.IsCommandRunningRespose{}, nil).MinTimes(2)
// 			},
// 			Res: &Infringement{
// 				Description: "user ran barely blacklisted command: b_foo",
// 				Kind:        GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityBarely),
// 			},
// 		},

// 		{
// 			Desc: "default infringement",
// 			Opts: []NewAgentSmithOption{WithBlacklists(blacklists)},
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().IsCommandRunning(gomock.Any(), gomock.Eq(&sentinel.IsCommandRunningRequest{Command: binaries("d_")})).Return(&sentinel.IsCommandRunningRespose{
// 					Findings: binaries("d_"),
// 				}, nil).MinTimes(1)
// 				m.EXPECT().IsCommandRunning(gomock.Any(), gomock.Any()).Return(&sentinel.IsCommandRunningRespose{}, nil).MinTimes(1)
// 			},
// 			Res: &Infringement{
// 				Description: "user ran  blacklisted command: d_foo",
// 				Kind:        GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityAudit),
// 			},
// 		},

// 		{
// 			Desc: "very infringement",
// 			Opts: []NewAgentSmithOption{WithBlacklists(blacklists)},
// 			Mock: func(t *testing.T, m *sentinel.MockSentinelServer) {
// 				m.EXPECT().IsCommandRunning(gomock.Any(), gomock.Eq(&sentinel.IsCommandRunningRequest{Command: binaries("v_")})).Return(&sentinel.IsCommandRunningRespose{
// 					Findings: binaries("v_"),
// 				}, nil).MinTimes(1)
// 				m.EXPECT().IsCommandRunning(gomock.Any(), gomock.Any()).Return(&sentinel.IsCommandRunningRespose{}, nil).MaxTimes(0)
// 			},
// 			Res: &Infringement{
// 				Description: "user ran very blacklisted command: v_foo",
// 				Kind:        GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityVery),
// 			},
// 		},
// 	}
// 	for _, test := range tests {
// 		t.Run(test.Desc, func(t *testing.T) {
// 			agent, err := NewAgentSmith(fakek8s.NewSimpleClientset(), test.Opts...)
// 			if err != nil {
// 				t.Fatalf("cannot create test agent: %q", err)
// 			}

// 			ctrl := gomock.NewController(t)
// 			defer ctrl.Finish()

// 			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
// 			defer cancel()

// 			sensrv := sentinel.NewMockSentinelServer(ctrl)
// 			test.Mock(t, sensrv)
// 			conn, err := connectToMockSentinel(ctx, sensrv)
// 			if err != nil {
// 				t.Fatalf("cannot connect to mock sentinel: %q", err)
// 			}

// 			sen := sentinel.NewSentinelClient(conn)
// 			res, err := agent.checkForBlacklistedCommand(ctx, "foobar", sen)
// 			if err != nil {
// 				t.Errorf("unexpected error: %q", err)
// 			}
// 			if diff := cmp.Diff(test.Res, res); diff != "" {
// 				t.Errorf("unexpected result (-want +got):\n%s", diff)
// 			}
// 		})
// 	}
// }

// func connectToMockSentinel(ctx context.Context, sensrv sentinel.SentinelServer) (*grpc.ClientConn, error) {
// 	lis := bufconn.Listen(1024 * 1024)
// 	srv := grpc.NewServer()
// 	sentinel.RegisterSentinelServer(srv, sensrv)
// 	go func() {
// 		err := srv.Serve(lis)
// 		if err != nil {
// 			panic(fmt.Sprintf("grpc failure: %q", err))
// 		}
// 	}()

// 	conn, err := grpc.DialContext(ctx, "bufnet", grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return lis.Dial() }), grpc.WithInsecure())
// 	if err != nil {
// 		return nil, err
// 	}
// 	return conn, nil
// }
