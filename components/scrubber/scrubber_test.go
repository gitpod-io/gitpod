// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"encoding/json"
	"math/rand"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func TestValue(t *testing.T) {
	tests := []struct {
		Name        string
		Value       string
		Expectation string
	}{
		{Name: "empty string"},
		{Name: "email", Value: "foo@bar.com", Expectation: "[redacted:email]"},
		{Name: "email in text", Value: "The email is foo@bar.com or bar@foo.com", Expectation: "The email is [redacted:email] or [redacted:email]"},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := Default.Value(test.Value)

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("Value() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestKeyValue(t *testing.T) {
	const testValue = "testvalue"
	tests := []struct {
		Key         string
		Expectation string
	}{
		{Key: "email", Expectation: "[redacted]"},
		{Key: "token", Expectation: "[redacted]"},
	}

	for _, test := range tests {
		t.Run(test.Key, func(t *testing.T) {
			act := Default.KeyValue(test.Key, testValue)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("KeyValue() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

var (
	_ TrustedValue = &TrustedStructToTest{}
)

type StructToTest struct {
	Username string
	Email    string
	Password string
}

type TrustedStructToTest struct {
	StructToTest
}

type TestWrap struct {
	Test *StructToTest
}

type UnexportedStructToTest struct {
	Exported      string
	unexportedPtr *string
}

func (TrustedStructToTest) IsTrustedValue() {}

func scrubStructToTestAsTrustedValue(v *StructToTest) TrustedValue {
	return scrubStructToTest(v)
}

func scrubStructToTest(v *StructToTest) *TrustedStructToTest {
	return &TrustedStructToTest{
		StructToTest: StructToTest{
			Username: v.Username,
			Email:    "trusted:" + Default.Value(v.Email),
			Password: "trusted:" + Default.KeyValue("password", v.Password),
		},
	}
}

func TestStruct(t *testing.T) {
	type Expectation struct {
		Error  string
		Result any
	}
	tests := []struct {
		Name        string
		Struct      any
		Expectation Expectation
		CmpOpts     []cmp.Option
	}{
		{
			Name: "basic happy path",
			Struct: &struct {
				Username     string
				Email        string
				Password     string
				WorkspaceID  string
				ContextURL   string
				LeaveMeAlone string
			}{Username: "foo", Email: "foo@bar.com", Password: "foobar", WorkspaceID: "gitpodio-gitpod-uesaddev73c", ContextURL: "https://github.com/gitpod-io/gitpod/pull/19402", LeaveMeAlone: "foo"},
			Expectation: Expectation{
				Result: &struct {
					Username     string
					Email        string
					Password     string
					WorkspaceID  string
					ContextURL   string
					LeaveMeAlone string
				}{Username: "[redacted:md5:acbd18db4cc2f85cedef654fccc4a4d8]", Email: "[redacted]", Password: "[redacted]", WorkspaceID: "[redacted:md5:a35538939333def8477b5c19ac694b35]", ContextURL: "[redacted:md5:3097fca9b1ec8942c4305e550ef1b50a]/[redacted:md5:308cb0f82b8a4966a32f7c360315c160]/[redacted:md5:5bc8d0354fba47db774b70d2a9161bbb]/pull/19402", LeaveMeAlone: "foo"},
			},
		},
		{
			Name: "map field",
			Struct: &struct {
				WithMap map[string]interface{}
			}{
				WithMap: map[string]interface{}{
					"email": "foo@bar.com",
				},
			},
			Expectation: Expectation{
				Result: &struct{ WithMap map[string]any }{WithMap: map[string]any{"email": string("[redacted]")}},
			},
		},
		{
			Name: "slices",
			Struct: &struct {
				Slice []string
			}{Slice: []string{"foo", "bar", "foo@bar.com"}},
			Expectation: Expectation{
				Result: &struct {
					Slice []string
				}{Slice: []string{"foo", "bar", "[redacted:email]"}},
			},
		},
		{
			Name: "struct tags",
			Struct: &struct {
				Hashed   string `scrub:"hash"`
				Redacted string `scrub:"redact"`
				Email    string `scrub:"ignore"`
			}{
				Hashed:   "foo",
				Redacted: "foo",
				Email:    "foo",
			},
			Expectation: Expectation{
				Result: &struct {
					Hashed   string `scrub:"hash"`
					Redacted string `scrub:"redact"`
					Email    string `scrub:"ignore"`
				}{
					Hashed:   "[redacted:md5:acbd18db4cc2f85cedef654fccc4a4d8]",
					Redacted: "[redacted]",
					Email:    "foo",
				},
			},
		},
		{
			Name: "trusted struct",
			Struct: scrubStructToTest(&StructToTest{
				Username: "foo",
				Email:    "foo@bar.com",
				Password: "foobar",
			}),
			Expectation: Expectation{
				Result: &TrustedStructToTest{
					StructToTest: StructToTest{
						Username: "foo",
						Email:    "trusted:[redacted:email]",
						Password: "trusted:[redacted]",
					},
				},
			},
		},
		{
			Name: "trusted interface",
			Struct: scrubStructToTestAsTrustedValue(&StructToTest{
				Username: "foo",
				Email:    "foo@bar.com",
				Password: "foobar",
			}),
			Expectation: Expectation{
				Result: &TrustedStructToTest{
					StructToTest: StructToTest{
						Username: "foo",
						Email:    "trusted:[redacted:email]",
						Password: "trusted:[redacted]",
					},
				},
			},
		},
		{
			Name: "contains unexported pointers",
			Struct: UnexportedStructToTest{
				Exported:      "foo",
				unexportedPtr: nil,
			},
			Expectation: Expectation{
				Result: UnexportedStructToTest{
					Exported:      "foo",
					unexportedPtr: nil,
				},
			},
			CmpOpts: []cmp.Option{cmpopts.IgnoreUnexported(UnexportedStructToTest{})},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation

			err := Default.Struct(test.Struct)
			if err != nil {
				act.Error = err.Error()
			} else {
				act.Result = test.Struct
			}

			if diff := cmp.Diff(test.Expectation, act, test.CmpOpts...); diff != "" {
				t.Errorf("Struct() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestJSON(t *testing.T) {
	type Expectation struct {
		Error  string
		Result string
	}
	tests := []struct {
		Name        string
		Input       string
		Expectation Expectation
	}{
		{
			Name:  "basic happy path",
			Input: `{"ok": true, "email": "foo@bar.com", "workspaceID": "gitpodio-gitpod-uesaddev73c"}`,
			Expectation: Expectation{
				Result: `{"email":"[redacted]","ok":true,"workspaceID":"[redacted:md5:a35538939333def8477b5c19ac694b35]"}`,
			},
		},
		{
			Name:        "analytics",
			Input:       `{"batch":[{"event":"signup","foo":"bar","type":"track"}],"foo":"bar"}`,
			Expectation: Expectation{Result: `{"batch":[{"event":"signup","foo":"bar","type":"track"}],"foo":"bar"}`},
		},
		{
			// https://github.com/gitpod-io/security/issues/64
			Name:  "complex",
			Input: `{"auth":{"owner_token":"abcsecrettokendef","total":{}},"env":[{"name":"SECRET_PASSWORD","value":"i-am-leaked-in-the-logs-yikes"},{"name":"GITHUB_TOKEN","value":"thisismyGitHubTokenDontStealIt"},{"name":"SUPER_SEKRET","value":"you.cant.see.me.or.can.you"},{"name":"GITHUB_SSH_PRIVATE_KEY","value":"super-secret-private-ssh-key-from-github"},{"name":"SHELL","value":"zsh"},{"name":"GITLAB_TOKEN","value":"abcsecrettokendef"}],"source":{"file":{"contextPath":".","dockerfilePath":".gitpod.dockerfile","dockerfileVersion":"82561e7f6455e3c0e6ee98be03c4d9aab4d459f8","source":{"git":{"checkoutLocation":"test.repo","cloneTaget":"good-workspace-image","config":{"authPassword":"super-secret-password","authUser":"oauth2","authentication":"BASIC_AUTH"},"remoteUri":"https://github.com/AlexTugarev/test.repo.git","targetMode":"REMOTE_BRANCH"}}}}}`,
			Expectation: Expectation{
				Result: `{"auth":{"owner_token":"[redacted]","total":{}},"env":[{"name":"SECRET_PASSWORD","value":"[redacted]"},{"name":"GITHUB_TOKEN","value":"[redacted]"},{"name":"SUPER_SEKRET","value":"you.cant.see.me.or.can.you"},{"name":"GITHUB_SSH_PRIVATE_KEY","value":"[redacted]"},{"name":"SHELL","value":"zsh"},{"name":"GITLAB_TOKEN","value":"[redacted]"}],"source":{"file":{"contextPath":".","dockerfilePath":".gitpod.dockerfile","dockerfileVersion":"82561e7f6455e3c0e6ee98be03c4d9aab4d459f8","source":{"git":{"checkoutLocation":"test.repo","cloneTaget":"good-workspace-image","config":{"authPassword":"[redacted]","authUser":"oauth2","authentication":"BASIC_AUTH"},"remoteUri":"https://github.com/AlexTugarev/test.repo.git","targetMode":"REMOTE_BRANCH"}}}}}`,
			},
		},
		{
			Name:        "string",
			Input:       `"foo@bar.com"`,
			Expectation: Expectation{Result: `"[redacted:email]"`},
		},
		{
			Name:        "array",
			Input:       `["foo@bar.com"]`,
			Expectation: Expectation{Result: `["[redacted:email]"]`},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation

			res, err := Default.JSON([]byte(test.Input))
			if err != nil {
				act.Error = err.Error()
			}
			act.Result = string(res)

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("JSON() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestDeepCopyStruct(t *testing.T) {
	type Expectation struct {
		Error  string
		Result any
	}
	tests := []struct {
		Name        string
		Struct      any
		Expectation Expectation
		CmpOpts     []cmp.Option
	}{
		{
			Name: "basic happy path",
			Struct: &struct {
				Username     string
				Email        string
				Password     string
				WorkspaceID  string
				LeaveMeAlone string
			}{Username: "foo", Email: "foo@bar.com", Password: "foobar", WorkspaceID: "gitpodio-gitpod-uesaddev73c", LeaveMeAlone: "foo"},
			Expectation: Expectation{
				Result: &struct {
					Username     string
					Email        string
					Password     string
					WorkspaceID  string
					LeaveMeAlone string
				}{Username: "[redacted:md5:acbd18db4cc2f85cedef654fccc4a4d8]", Email: "[redacted]", Password: "[redacted]", WorkspaceID: "[redacted:md5:a35538939333def8477b5c19ac694b35]", LeaveMeAlone: "foo"},
			},
		},
		{
			Name: "stuct without pointer",
			Struct: struct {
				Username     string
				Email        string
				Password     string
				WorkspaceID  string
				LeaveMeAlone string
			}{Username: "foo", Email: "foo@bar.com", Password: "foobar", WorkspaceID: "gitpodio-gitpod-uesaddev73c", LeaveMeAlone: "foo"},
			Expectation: Expectation{
				Result: struct {
					Username     string
					Email        string
					Password     string
					WorkspaceID  string
					LeaveMeAlone string
				}{Username: "[redacted:md5:acbd18db4cc2f85cedef654fccc4a4d8]", Email: "[redacted]", Password: "[redacted]", WorkspaceID: "[redacted:md5:a35538939333def8477b5c19ac694b35]", LeaveMeAlone: "foo"},
			},
		},
		{
			Name: "map field",
			Struct: &struct {
				WithMap map[string]interface{}
			}{
				WithMap: map[string]interface{}{
					"email": "foo@bar.com",
				},
			},
			Expectation: Expectation{
				Result: &struct{ WithMap map[string]any }{WithMap: map[string]any{"email": string("[redacted]")}},
			},
		},
		{
			Name: "slices",
			Struct: &struct {
				Slice []string
			}{Slice: []string{"foo", "bar", "foo@bar.com"}},
			Expectation: Expectation{
				Result: &struct {
					Slice []string
				}{Slice: []string{"foo", "bar", "[redacted:email]"}},
			},
		},
		{
			Name: "struct tags",
			Struct: &struct {
				Hashed   string `scrub:"hash"`
				Redacted string `scrub:"redact"`
				Email    string `scrub:"ignore"`
			}{
				Hashed:   "foo",
				Redacted: "foo",
				Email:    "foo",
			},
			Expectation: Expectation{
				Result: &struct {
					Hashed   string `scrub:"hash"`
					Redacted string `scrub:"redact"`
					Email    string `scrub:"ignore"`
				}{
					Hashed:   "[redacted:md5:acbd18db4cc2f85cedef654fccc4a4d8]",
					Redacted: "[redacted]",
					Email:    "foo",
				},
			},
		},
		{
			Name: "trusted struct",
			Struct: scrubStructToTest(&StructToTest{
				Username: "foo",
				Email:    "foo@bar.com",
				Password: "foobar",
			}),
			Expectation: Expectation{
				Result: &TrustedStructToTest{
					StructToTest: StructToTest{
						Username: "foo",
						Email:    "trusted:[redacted:email]",
						Password: "trusted:[redacted]",
					},
				},
			},
		},
		{
			Name: "trusted interface",
			Struct: scrubStructToTestAsTrustedValue(&StructToTest{
				Username: "foo",
				Email:    "foo@bar.com",
				Password: "foobar",
			}),
			Expectation: Expectation{
				Result: &TrustedStructToTest{
					StructToTest: StructToTest{
						Username: "foo",
						Email:    "trusted:[redacted:email]",
						Password: "trusted:[redacted]",
					},
				},
			},
		},
		{
			Name: "contains unexported pointers",
			Struct: UnexportedStructToTest{
				Exported:      "foo",
				unexportedPtr: nil,
			},
			Expectation: Expectation{
				Result: UnexportedStructToTest{
					Exported:      "foo",
					unexportedPtr: nil,
				},
			},
			CmpOpts: []cmp.Option{cmpopts.IgnoreUnexported(UnexportedStructToTest{})},
		},
		{
			Name: "nil interface",
			Struct: &struct {
				Hashed       string `scrub:"hash"`
				NilInterface interface{}
			}{
				Hashed: "foo",
			},
			Expectation: Expectation{
				Result: &struct {
					Hashed       string `scrub:"hash"`
					NilInterface interface{}
				}{
					Hashed:       "[redacted:md5:acbd18db4cc2f85cedef654fccc4a4d8]",
					NilInterface: nil,
				},
			},
		},
		{
			Name: "nil point interface",
			Struct: &struct {
				Hashed       string `scrub:"hash"`
				NilInterface *string
			}{
				Hashed: "foo",
			},
			Expectation: Expectation{
				Result: &struct {
					Hashed       string `scrub:"hash"`
					NilInterface *string
				}{
					Hashed:       "[redacted:md5:acbd18db4cc2f85cedef654fccc4a4d8]",
					NilInterface: nil,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation
			b, _ := json.Marshal(test.Struct)

			act.Result = Default.DeepCopyStruct(test.Struct)
			b2, _ := json.Marshal(test.Struct)

			if diff := cmp.Diff(b, b2, test.CmpOpts...); diff != "" {
				t.Errorf("DeepCopyStruct for origin struct modified (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(test.Expectation, act, test.CmpOpts...); diff != "" {
				t.Errorf("DeepCopyStruct() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func BenchmarkKeyValue(b *testing.B) {
	key := HashedFieldNames[rand.Intn(len(HashedFieldNames))]

	for i := 0; i < b.N; i++ {
		Default.KeyValue(key, "value")
	}
}

// go test -bench=BenchmarkMetrics -benchmem -benchtime=5s
// regex:
// BenchmarkMetrics-32            5        1106232258 ns/op            8228 B/op          1 allocs/op
// strings.Contains:
// BenchmarkMetrics-32          190          30726112 ns/op         3098513 B/op      61369 allocs/op
// strings.Contains + lru cache on key:
// BenchmarkMetrics-32          303          19896634 ns/op         3098512 B/op      61369 allocs/op
//
// Commented out to exclude the prometheus dependency.
// func BenchmarkMetrics(b *testing.B) {
// 	// 1 MB firehose metrics file.
// 	// file contains newline-separated json objects in the format {"b": "<data>"}
// 	// where <data> is a base64-encoded string
// 	file := "/workspace/gitpod/components/scrubber/metrics-file"
// 	var data []string
// 	osFile, err := os.Open(file)
// 	if err != nil {
// 		b.Fatal(err)
// 	}
// 	defer osFile.Close()
// 	dec := json.NewDecoder(osFile)
// 	for dec.More() {
// 		var obj map[string]string
// 		err := dec.Decode(&obj)
// 		if err != nil {
// 			b.Fatal(err)
// 		}
// 		data = append(data, obj["b"])
// 	}

// 	var reqs []*prompb.WriteRequest
// 	for _, d := range data {
// 		reader := base64.NewDecoder(base64.StdEncoding, strings.NewReader(d))
// 		req, err := remote.DecodeWriteRequest(reader)
// 		if err != nil {
// 			b.Fatal(err)
// 		}
// 		reqs = append(reqs, req)
// 	}

// 	b.ResetTimer()
// 	for i := 0; i < b.N; i++ {
// 		for _, req := range reqs {
// 			for _, ts := range req.Timeseries {
// 				for _, l := range ts.Labels {
// 					_ = Default.KeyValue(l.Name, l.Value)
// 				}
// 			}
// 		}
// 	}
// }

func BenchmarkValue(b *testing.B) {
	const input = "This text contains {\"json\":\"data\"}, a workspace ID gitpodio-gitpod-uesaddev73c and an email foo@bar.com"

	for i := 0; i < b.N; i++ {
		Default.Value(input)
	}
}
