// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package git

import (
	"bytes"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestParsePorcelain(t *testing.T) {
	tests := []struct {
		Input       string
		Expectation *porcelainStatus
		Error       error
	}{
		{`# branch.oid e48df267d11a16a04101e3f503aef27f8352e7fb
# branch.head cw/git-status
1 .M N... 100644 100644 100644 9f8efaf877a34290b1ec672ea76ed23ae1f6fc0e 9f8efaf877a34290b1ec672ea76ed23ae1f6fc0e ../../client/wsready.d.ts
1 .M N... 100644 100644 100644 fecd2cb9388debfa8b55eff29042940c6b48e34f fecd2cb9388debfa8b55eff29042940c6b48e34f ../../client/wsdaemon_grpc_pb.d.ts
1 .M N... 100644 100644 100644 21d9ddf581bb8c76d4c57e751d6ca70f20d6d988 21d9ddf581bb8c76d4c57e751d6ca70f20d6d988 ../../client/wsdaemon_grpc_pb.js
1 .M N... 100644 100644 100644 0fdd088bb302577f8d9f7b1e24bf1982f1e0b339 0fdd088bb302577f8d9f7b1e24bf1982f1e0b339 ../../client/wsdaemon_pb.d.ts
1 .M N... 100644 100644 100644 5aebcbc6f8e2c400440b08e1ef9a8cf207121ba0 5aebcbc6f8e2c400440b08e1ef9a8cf207121ba0 ../../client/wsdaemon_pb.js
1 .M N... 100644 100644 100644 afb7787839a21a1c6ec96b11ac771966e6e59e27 afb7787839a21a1c6ec96b11ac771966e6e59e27 ../../go.mod
1 .M N... 100644 100644 100644 6e158cd7a2cddc9904ca4958bb2a919ef76aa93b 6e158cd7a2cddc9904ca4958bb2a919ef76aa93b ../../go.sum
1 .M N... 100644 100644 100644 59cbc1f794f8d0809985b8400824defc1812118a 59cbc1f794f8d0809985b8400824defc1812118a ../internal/session/workspace.go
1 .M N... 100644 100644 100644 33136abd6ca52574c44ce9dc4c6892ff1dc4747a 33136abd6ca52574c44ce9dc4c6892ff1dc4747a wsdaemon.pb.go
1 .M N... 100644 100644 100644 4108d304df5c42949c54b8b84dff7af06684ddcc 4108d304df5c42949c54b8b84dff7af06684ddcc wsdaemon.proto
1 .M N... 100644 100644 100644 d6ea4d281da87355dad7040893bf8b0328dc0c60 d6ea4d281da87355dad7040893bf8b0328dc0c60 ../syncd/service.go
? ../../../../foo`,
			&porcelainStatus{
				BranchOID:  "e48df267d11a16a04101e3f503aef27f8352e7fb",
				BranchHead: "cw/git-status",
				UncommitedFiles: []string{
					"../../client/wsready.d.ts",
					"../../client/wsdaemon_grpc_pb.d.ts",
					"../../client/wsdaemon_grpc_pb.js",
					"../../client/wsdaemon_pb.d.ts",
					"../../client/wsdaemon_pb.js",
					"../../go.mod",
					"../../go.sum",
					"../internal/session/workspace.go",
					"wsdaemon.pb.go",
					"wsdaemon.proto",
					"../syncd/service.go",
				},
				UntrackedFiles: []string{
					"../../../../foo",
				},
			},
			nil,
		},
		{`# branch.oid 68265e04346e5955f738765ef65fe51ae3602d9c
# branch.head master
# branch.upstream origin/master
# branch.ab +1 -0
? x
? a/b/c/d/e`,
			&porcelainStatus{
				BranchOID:      "68265e04346e5955f738765ef65fe51ae3602d9c",
				BranchHead:     "master",
				UntrackedFiles: []string{"x", "a/b/c/d/e"},
			},
			nil,
		},
	}

	for _, test := range tests {
		res, err := parsePorcelain(bytes.NewReader([]byte(test.Input)))
		if err != test.Error {
			t.Errorf("expected errors do not match: %v != %v", err, test.Error)
		}

		if diff := cmp.Diff(test.Expectation, res, cmp.AllowUnexported(porcelainStatus{})); diff != "" {
			t.Errorf("unexpected result (-want +got):\n%s", diff)
		}
	}
}
