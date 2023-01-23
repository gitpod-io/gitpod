// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"encoding/base64"
	"fmt"
	"log"
	"time"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/pointer"
	"sigs.k8s.io/yaml"
)

func main() {
	initializer, _ := base64.StdEncoding.DecodeString("IoUCCn8KfXdvcmtzcGFjZXMvZ2l0cG9kaW8tZ2l0cG9kLTZjbDB6b2o0N2Z4L3NuYXBzaG90LTE2NTA2NDE3NzQ0MzUxMDExODMudGFyQGdpdHBvZC1wcm9kLXVzZXItMmRmNTNjMGItODgwZi00NmYxLWI3MmUtOWIwNDM3ZDYyOGEzEoEBCidodHRwczovL2dpdGh1Yi5jb20vZ2l0cG9kLWlvL2dpdHBvZC5naXQYAiIEbWFpbioGZ2l0cG9kMkYQAipCaHR0cHM6Ly9naXRwb2QuaW8vYXBpL290cy9nZXQvOGUyODI3YmYtZGI5Zi00ZmNiLWE5YzItZTc3N2Y2YTE3NWI2")
	ws := workspacev1.Workspace{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "workspace.gitpod.io/v1",
			Kind:       "Workspace",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: "d735b3d9-e24b-492c-926f-eb5cd7cb1c3a",
		},
		Spec: workspacev1.WorkspaceSpec{
			Ownership: workspacev1.Ownership{
				Owner:       "f2e2a512-9056-4de7-8a07-0210162055fc",
				WorkspaceID: "gitpodio-gitpod-qy1xib2g0a0",
			},
			Type: workspacev1.WorkspaceTypeRegular,
			Image: workspacev1.WorkspaceImages{
				Workspace: workspacev1.WorkspaceImage{Ref: pointer.String("eu.gcr.io/gitpod-dev/workspace-images:c80f600433dad18e4dc852b26367da732536f5dcf69dc813af8fe58f5eb73b16")},
				IDE: workspacev1.IDEImages{
					Web:        "eu.gcr.io/gitpod-core-dev/build/ide/code:nightly@sha256:5ad86443d01645a1c7011938ccac4b5ebbaffb0cf4b55ee51ee45296bfd5804b",
					Supervisor: "eu.gcr.io/gitpod-core-dev/build/supervisor:commit-5d5781983089056e37d34c762f1f291b9a796357",
				},
			},
			Initializer:       initializer,
			WorkspaceLocation: "/workspace/gitpod",
			Timeout: workspacev1.TimeoutSpec{
				Time: &metav1.Duration{Duration: 60 * time.Minute},
			},
			Admission: workspacev1.AdmissionSpec{
				Level: workspacev1.AdmissionLevelOwner,
			},
		},
	}
	out, err := yaml.Marshal(ws)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(out))
}
