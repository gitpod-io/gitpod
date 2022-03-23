// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package provider

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/gitpod-io/gitpod/policy-agent/api"
	"k8s.io/apimachinery/pkg/util/yaml"
)

func NewFilePolicyProvider(path string) (*FilePolicyProvider, error) {
	var (
		res FilePolicyProvider
		err error
	)
	res.Default, err = NewSingleFilePolicyProvider(filepath.Join(path, "default.yaml"))
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("no default policy found: %w", err)
	}
	if err != nil {
		return nil, err
	}

	res.PerUser, err = loadPolicyMap(filepath.Join(path, "user"))
	if err != nil {
		return nil, err
	}
	res.PerTeam, err = loadPolicyMap(filepath.Join(path, "team"))
	if err != nil {
		return nil, err
	}

	return &res, nil
}

func loadPolicyMap(dir string) (map[string]*SingleFilePolicyProvider, error) {
	res := make(map[string]*SingleFilePolicyProvider)

	userps, err := ioutil.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	for _, f := range userps {
		p, err := NewSingleFilePolicyProvider(filepath.Join(dir, f.Name()))
		if err != nil {
			return nil, err
		}
		uid := strings.TrimPrefix(f.Name(), filepath.Ext(f.Name()))
		res[uid] = p
	}
	return res, nil
}

func NewSingleFilePolicyProvider(path string) (*SingleFilePolicyProvider, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var pf PolicyFile
	err = yaml.NewYAMLOrJSONDecoder(f, 512).Decode(&pf)
	if err != nil {
		return nil, err
	}
	return &SingleFilePolicyProvider{Policy: pf}, nil
}

type FilePolicyProvider struct {
	api.UnimplementedPolicyServiceServer

	Default *SingleFilePolicyProvider
	PerUser map[string]*SingleFilePolicyProvider
	PerTeam map[string]*SingleFilePolicyProvider
}

func (s *FilePolicyProvider) Permission(ctx context.Context, req *api.PermissionRequest) (*api.PermissionResponse, error) {
	if usr, ok := s.PerUser[req.Subject.UserId]; ok {
		dec, err := usr.Permission(ctx, req)
		if err != nil {
			return nil, err
		}
		dec.DecidingPolicyName = "user-policy"
		return dec, nil
	}
	if tm, ok := s.PerTeam[req.Subject.TeamId]; ok {
		dec, err := tm.Permission(ctx, req)
		if err != nil {
			return nil, err
		}
		dec.DecidingPolicyName = "team-policy"
		return dec, nil
	}

	dec, err := s.Default.Permission(ctx, req)
	if err != nil {
		return nil, err
	}
	dec.DecidingPolicyName = "default-policy"
	return dec, nil
}

type SingleFilePolicyProvider struct {
	api.UnimplementedPolicyServiceServer

	Policy PolicyFile
}

type PolicyFile []PolicyDecision

type PolicyDecision struct {
	Kind        string `json:"kind"`
	Allowed     bool   `json:"allowed"`
	Limit       *int64 `json:"limit"`
	Remediation string `json:"remediation"`
}

func (s *SingleFilePolicyProvider) Permission(ctx context.Context, req *api.PermissionRequest) (*api.PermissionResponse, error) {
	for _, dec := range s.Policy {
		if dec.Kind != api.PermissionRequest_Kind_name[int32(req.Kind)] {
			continue
		}

		if !dec.Allowed {
			return &api.PermissionResponse{
				Allowed:            false,
				DecidingPolicyName: "single-file-policy",
				UserMessage:        "policy does not allow this",
				UserRemediation:    dec.Remediation,
			}, nil
		}
		if dec.Limit != nil {
			if req.Request > *dec.Limit {
				return &api.PermissionResponse{
					Allowed:            false,
					DecidingPolicyName: "single-file-policy",
					UserMessage:        fmt.Sprintf("request (%d) exceeds limit (%d)", req.Request, *dec.Limit),
					UserRemediation:    dec.Remediation,
				}, nil
			}
		}
	}

	return &api.PermissionResponse{
		Allowed: true,
	}, nil
}
