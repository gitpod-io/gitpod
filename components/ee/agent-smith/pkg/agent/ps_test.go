// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent_test

import (
	"bytes"
	"testing"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/agent"
)

func TestParsePsOutput(t *testing.T) {
	output := ` 44        1       0 /sbin/init                  /sbin/init
   44  	2       0 [kthreadd]                  [kthreadd]
   44  703086       1 /usr/bin/containerd-shim-ru /usr/bin/containerd-shim-runc-v2 -namespace k8s.io -id 8cf134feed45d9075f5cecdccc75c99e540f91bb4806ba17b91bb0aa350ba82c -address /run/co
   44  703109  703086 /pause                      /pause
   44  703198  703086 /.supervisor/workspacekit r /.supervisor/workspacekit ring0
   44  703243  703198 /proc/self/exe ring1 --mapp /proc/self/exe ring1 --mapping-established
   44  703257  703243 supervisor run              supervisor run
   44  703301  703257 /ide/node/bin/gitpod-node - /ide/node/bin/gitpod-node --inspect ./out/gitpod.js /workspace/template-golang-cli --port 23000 --hostname 0.0.0.0 --verbose --log=trace
   44  703359  703257 /bin/bash                   /bin/bash
   44  703462  703257 /.supervisor/dropbear/dropb /.supervisor/dropbear/dropbear -F -E -w -s -p :23001 -r /tmp/hostkey2017735775
   44  703929  703301 /ide/node/bin/gitpod-node / /ide/node/bin/gitpod-node /ide/out/bootstrap-fork --type=watcherService
   44  704558  703301 /ide/node/bin/gitpod-node / /ide/node/bin/gitpod-node /ide/out/bootstrap-fork --type=extensionHost --uriTransformerPath=/ide/out/serverUriTransformer
   44  704640  704558 /ide/node/bin/gitpod-node / /ide/node/bin/gitpod-node /ide/extensions/redhat.vscode-yaml/node_modules/yaml-language-server/out/server/src/server.js --node-ipc --cli
   44  704653  704558 /ide/node/bin/gitpod-node / /ide/node/bin/gitpod-node /ide/extensions/json-language-features/server/dist/node/jsonServerMain --node-ipc --clientProcessId=423
`

	m, err := agent.ParsePsOutput(bytes.NewBufferString(output))
	if err != nil {
		t.Fatal(err)
	}

	p1 := m.GetByPID(1)
	if p1 == nil {
		t.Fatal("expected process 1 to be present")
	}
	p0, ok := m.GetParent(p1.PID)
	if !ok {
		t.Fatal("expected process 1 to still be present")
	}
	if p0 != nil {
		t.Fatal("expected process 0 not to be present")
	}

	p := m.GetByPID(703198)
	if p == nil {
		t.Fatal("expected process 703198 to be present")
	}

	cs := m.ListAllChildren(p.PID)
	contained := false
	for _, c := range cs {
		if c.PID == 704653 {
			contained = true
			break
		}
	}
	if !contained {
		t.Fatal("expected process 704653 to be an indirect child of 703198")
	}

	supervisor := m.FindSupervisorForChild(703929)
	if supervisor == nil || supervisor.PID != 703257 {
		t.Fatalf("expected 703257 to be supervisor process, got %d", supervisor.PID)
	}

	supervisorDown := m.FindSupervisorForRootProcess(703198)
	if supervisorDown == nil || supervisor.PID != 703257 {
		t.Fatalf("expected 703257 to be supervisor process, got %d", supervisor.PID)
	}
}
