// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package licensor

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"testing"
	"time"
)

const (
	seats                = 5
	domain               = "foobar.com"
	someID               = "730d5134-768c-4a05-b7cd-ecf3757cada9"
	replicatedLicenseUrl = "http://kotsadm:3000/license/v1/license"
)

type licenseTest struct {
	Name         string
	License      *LicensePayload
	Validate     func(t *testing.T, eval *Evaluator)
	Type         LicenseType
	NeverExpires bool
}

// roundTripFunc .
type roundTripFunc func(req *http.Request) *http.Response

// roundTrip .
func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

// newTestClient returns *http.Client with Transport replaced to avoid making real calls
func newTestClient(fn roundTripFunc) *http.Client {
	return &http.Client{
		Transport: roundTripFunc(fn),
	}
}

func (test *licenseTest) Run(t *testing.T) {
	t.Run(test.Name, func(t *testing.T) {
		var eval *Evaluator
		if test.Type == LicenseTypeGitpod {
			if test.NeverExpires {
				t.Fatal("gitpod licenses must have an expiry date")
			}

			if test.License == nil {
				eval = NewGitpodEvaluator(nil, "")
			} else {
				priv, err := rsa.GenerateKey(rand.Reader, 2048)
				if err != nil {
					t.Fatalf("cannot generate key: %q", err)
				}
				publicKeys = []*rsa.PublicKey{&priv.PublicKey}
				lic, err := Sign(*test.License, priv)
				if err != nil {
					t.Fatalf("cannot sign license: %q", err)
				}

				eval = NewGitpodEvaluator(lic, domain)
			}
		} else if test.Type == LicenseTypeReplicated {
			client := newTestClient(func(req *http.Request) *http.Response {
				act := req.URL.String()
				if act != "http://kotsadm:3000/license/v1/license" {
					t.Fatalf("invalid kotsadm url match: expected %s, got %v", replicatedLicenseUrl, act)
				}

				payload, err := json.Marshal(replicatedLicensePayload{
					ExpirationTime: func() *time.Time {
						if test.License != nil {
							return &test.License.ValidUntil
						}
						if !test.NeverExpires {
							t := time.Now().Add(-6 * time.Hour)
							return &t
						}
						return nil
					}(),
					Fields: []replicatedFields{
						{
							Field: "domain",
							Value: func() string {
								if test.License != nil {
									return test.License.Domain
								}
								return domain
							}(),
						},
						{
							Field: "levelId",
							Value: func() LicenseLevel {
								if test.License != nil {
									return test.License.Level
								}
								return LevelTeam
							}(),
						},
						{
							Field: "seats",
							Value: func() int {
								if test.License != nil {
									return test.License.Seats
								}
								return seats
							}(),
						},
					},
				})
				if err != nil {
					t.Fatalf("failed to convert payload: %v", err)
				}

				return &http.Response{
					StatusCode: 200,
					Body:       ioutil.NopCloser(bytes.NewBuffer(payload)),
					Header:     make(http.Header),
				}
			})

			if test.License == nil {
				eval = newReplicatedEvaluator(client, domain)
			} else {
				eval = newReplicatedEvaluator(client, test.License.Domain)
			}
		} else {
			t.Fatalf("unknown license type: '%s'", test.Type)
		}

		test.Validate(t, eval)
	})
}

func TestSeats(t *testing.T) {
	tests := []struct {
		Name           string
		Licensed       int
		Probe          int
		WithinLimits   bool
		DefaultLicense bool
		InvalidLicense bool
		LicenseType    LicenseType
		NeverExpires   bool
	}{
		{"Gitpod: unlimited seats", 0, 1000, true, false, false, LicenseTypeGitpod, false},
		{"Gitpod: within limited seats", 50, 40, true, false, false, LicenseTypeGitpod, false},
		{"Gitpod: within limited seats (edge)", 50, 50, true, false, false, LicenseTypeGitpod, false},
		{"Gitpod: beyond limited seats", 50, 150, false, false, false, LicenseTypeGitpod, false},
		{"Gitpod: beyond limited seats (edge)", 50, 51, false, false, false, LicenseTypeGitpod, false},
		{"Gitpod: invalid license", 50, 50, false, false, true, LicenseTypeGitpod, false},
		{"Gitpod: within default license seats", 0, 7, true, true, false, LicenseTypeGitpod, false},
		{"Gitpod: within default license seats (edge)", 0, 10, true, true, false, LicenseTypeGitpod, false},
		{"Gitpod: beyond default license seats", 0, 11, false, true, false, LicenseTypeGitpod, false},

		// correctly missing the default license tests as Replicated always has a license
		{"Replicated: unlimited seats", 0, 1000, true, false, false, LicenseTypeReplicated, false},
		{"Replicated: within limited seats", 50, 40, true, false, false, LicenseTypeReplicated, false},
		{"Replicated: within limited seats (edge)", 50, 50, true, false, false, LicenseTypeReplicated, false},
		{"Replicated: beyond limited seats", 50, 150, false, false, false, LicenseTypeReplicated, false},
		{"Replicated: beyond limited seats (edge)", 50, 51, false, false, false, LicenseTypeReplicated, false},
		{"Replicated: invalid license", 50, 50, false, false, true, LicenseTypeReplicated, false},
		{"Replicated: beyond default license seats", 0, 11, false, true, false, LicenseTypeReplicated, false},

		{"Replicated: unlimited seats", 0, 1000, true, false, false, LicenseTypeReplicated, true},
		{"Replicated: within limited seats", 50, 40, true, false, false, LicenseTypeReplicated, true},
		{"Replicated: within limited seats (edge)", 50, 50, true, false, false, LicenseTypeReplicated, true},
		{"Replicated: beyond limited seats", 50, 150, false, false, false, LicenseTypeReplicated, true},
		{"Replicated: beyond limited seats (edge)", 50, 51, false, false, false, LicenseTypeReplicated, true},
		{"Replicated: invalid license", 50, 50, false, false, true, LicenseTypeReplicated, true},
		{"Replicated: beyond default license seats", 0, 11, false, true, false, LicenseTypeReplicated, true},
		{"Replicated: invalid license within default seats", 50, 5, true, false, true, LicenseTypeReplicated, false},
	}

	for _, test := range tests {
		validUntil := time.Now().Add(6 * time.Hour)
		if test.InvalidLicense {
			validUntil = time.Now().Add(-6 * time.Hour)
		}

		lt := licenseTest{
			Name: test.Name,
			License: &LicensePayload{
				ID:         someID,
				Domain:     domain,
				Level:      LevelTeam,
				Seats:      test.Licensed,
				ValidUntil: validUntil,
			},
			Validate: func(t *testing.T, eval *Evaluator) {
				withinLimits := eval.HasEnoughSeats(test.Probe)
				if withinLimits != test.WithinLimits {
					t.Errorf("HasEnoughSeats did not behave as expected: lic=%d probe=%d expected=%v actual=%v", test.Licensed, test.Probe, test.WithinLimits, withinLimits)
				}
			},
			Type:         test.LicenseType,
			NeverExpires: test.NeverExpires,
		}
		if test.DefaultLicense {
			lt.License = nil
		}
		lt.Run(t)
	}
}

func TestFeatures(t *testing.T) {
	tests := []struct {
		Name           string
		DefaultLicense bool
		Level          LicenseLevel
		Features       []Feature
		LicenseType    LicenseType
	}{
		{"Gitpod: no license", true, LicenseLevel(0), []Feature{FeaturePrebuild, FeatureAdminDashboard}, LicenseTypeGitpod},
		{"Gitpod: invalid license level", false, LicenseLevel(666), []Feature{}, LicenseTypeGitpod},
		{"Gitpod: enterprise license", false, LevelEnterprise, []Feature{
			FeatureAdminDashboard,
			FeatureSetTimeout,
			FeatureWorkspaceSharing,
			FeatureSnapshot,
			FeaturePrebuild,
		}, LicenseTypeGitpod},

		{"Replicated: invalid license level", false, LicenseLevel(666), []Feature{}, LicenseTypeReplicated},
		{"Replicated: enterprise license", false, LevelEnterprise, []Feature{
			FeatureAdminDashboard,
			FeatureSetTimeout,
			FeatureWorkspaceSharing,
			FeatureSnapshot,
			FeaturePrebuild,
		}, LicenseTypeReplicated},
	}

	for _, test := range tests {
		lic := &LicensePayload{
			ID:         someID,
			Domain:     domain,
			Level:      test.Level,
			Seats:      seats,
			ValidUntil: time.Now().Add(6 * time.Hour),
		}
		if test.DefaultLicense {
			lic = nil
		}
		lt := licenseTest{
			Name:    test.Name,
			License: lic,
			Validate: func(t *testing.T, eval *Evaluator) {
				unavailableFeatures := featureSet{}
				for f := range allowanceMap[LevelEnterprise].Features {
					unavailableFeatures[f] = struct{}{}
				}
				for _, f := range test.Features {
					delete(unavailableFeatures, f)

					if !eval.Enabled(f) {
						t.Errorf("license does not enable %s, but should", f)
					}
				}

				for f := range unavailableFeatures {
					if eval.Enabled(f) {
						t.Errorf("license not enables %s, but shouldn't", f)
					}
				}
			},
			Type: test.LicenseType,
		}
		lt.Run(t)
	}
}

func TestEvalutorKeys(t *testing.T) {
	tests := []struct {
		Name       string
		Keygen     func() ([]*rsa.PublicKey, *rsa.PrivateKey, error)
		EvalDomain string
		Validation string
		ValidFor   time.Duration
	}{
		{
			Name: "single valid key",
			Keygen: func() ([]*rsa.PublicKey, *rsa.PrivateKey, error) {
				priv, err := rsa.GenerateKey(rand.Reader, 512)
				if err != nil {
					return nil, nil, err
				}
				return []*rsa.PublicKey{&priv.PublicKey}, priv, nil
			},
		},
		{
			Name: "single valid key but wrong domain",
			Keygen: func() ([]*rsa.PublicKey, *rsa.PrivateKey, error) {
				priv, err := rsa.GenerateKey(rand.Reader, 512)
				if err != nil {
					return nil, nil, err
				}
				return []*rsa.PublicKey{&priv.PublicKey}, priv, nil
			},
			EvalDomain: "wrong-" + domain,
			Validation: "wrong domain",
		},
		{
			Name:     "single valid key but outdated",
			ValidFor: -6 * time.Hour,
			Keygen: func() ([]*rsa.PublicKey, *rsa.PrivateKey, error) {
				priv, err := rsa.GenerateKey(rand.Reader, 512)
				if err != nil {
					return nil, nil, err
				}
				return []*rsa.PublicKey{&priv.PublicKey}, priv, nil
			},
			Validation: "not valid anymore",
		},
		{
			Name: "multiple valid keys",
			Keygen: func() (pks []*rsa.PublicKey, priv *rsa.PrivateKey, err error) {
				pks = make([]*rsa.PublicKey, 3)
				for i := 0; i < len(pks); i++ {
					priv, err = rsa.GenerateKey(rand.Reader, 512)
					if err != nil {
						return nil, nil, err
					}
					pks[i] = &priv.PublicKey
				}
				return pks, priv, nil
			},
		},
		{
			Name: "multiple wrong keys",
			Keygen: func() (pks []*rsa.PublicKey, priv *rsa.PrivateKey, err error) {
				pks = make([]*rsa.PublicKey, 3)
				for i := 0; i < len(pks); i++ {
					priv, err = rsa.GenerateKey(rand.Reader, 512)
					if err != nil {
						return nil, nil, err
					}
					pks[i] = &priv.PublicKey
				}

				priv, err = rsa.GenerateKey(rand.Reader, 512)
				if err != nil {
					return nil, nil, err
				}

				return pks, priv, nil
			},
			Validation: "cannot verify key: \"crypto/rsa: verification error\"",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			pks, priv, err := test.Keygen()
			if err != nil {
				t.Fatalf("cannot generate keys: %q", err)
			}
			if test.ValidFor == 0 {
				test.ValidFor = 24 * time.Hour
			}

			publicKeys = pks
			lic, err := Sign(LicensePayload{
				ID:         someID,
				Domain:     domain,
				Level:      LevelEnterprise,
				Seats:      5,
				ValidUntil: time.Now().Add(test.ValidFor),
			}, priv)
			if err != nil {
				t.Fatalf("cannot sign test license: %q", err)
			}

			dom := domain
			if test.EvalDomain != "" {
				dom = test.EvalDomain
			}

			var errmsg string
			e := NewGitpodEvaluator(lic, dom)
			if msg, valid := e.Validate(); !valid {
				errmsg = msg
			}
			if errmsg != test.Validation {
				t.Errorf("unepxected validation result: expected \"%s\", got \"%s\"", test.Validation, errmsg)
			}
		})
	}
}

func TestMatchesDomain(t *testing.T) {
	tests := []struct {
		Name    string
		Pattern string
		Domain  string
		Matches bool
	}{
		{Name: "no domain pattern", Pattern: "", Domain: "foobar.com", Matches: true},
		{Name: "exact match", Pattern: "foobar.com", Domain: "foobar.com", Matches: true},
		{Name: "exact mismatch", Pattern: "foobar.com", Domain: "does-not-match.com", Matches: false},
		{Name: "direct pattern match", Pattern: "*.foobar.com", Domain: "foobar.com", Matches: false},
		{Name: "pattern sub match", Pattern: "*.foobar.com", Domain: "foo.foobar.com", Matches: true},
		{Name: "direct pattern mismatch", Pattern: "*.foobar.com", Domain: "does-not-match.com", Matches: false},
		{Name: "pattern sub mismatch", Pattern: "*.foobar.com", Domain: "foo.does-not-match.com", Matches: false},
		{Name: "invalid pattern sub", Pattern: "foo.*.foobar.com", Domain: "foo.foobar.com", Matches: false},
		{Name: "invalid pattern empty", Pattern: "*.", Domain: "foobar.com", Matches: false},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := matchesDomain(test.Pattern, test.Domain)
			if act != test.Matches {
				t.Errorf("unexpected domain match: expected %v, got %v", test.Matches, act)
			}
		})
	}
}
