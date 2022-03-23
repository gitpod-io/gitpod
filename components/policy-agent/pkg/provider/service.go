// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package provider

import (
	"context"
	"sync"

	"github.com/gitpod-io/gitpod/policy-agent/api"
)

func NewDelegatePolicyProvider(d api.PolicyServiceServer) *DelegatePolicyProvider {
	return &DelegatePolicyProvider{d: d}
}

type DelegatePolicyProvider struct {
	api.UnimplementedPolicyServiceServer

	d  api.PolicyServiceServer
	mu sync.RWMutex
}

func (prov *DelegatePolicyProvider) Update(d api.PolicyServiceServer) {
	prov.mu.Lock()
	defer prov.mu.Unlock()

	prov.d = d
}

func (prov *DelegatePolicyProvider) Permission(ctx context.Context, req *api.PermissionRequest) (*api.PermissionResponse, error) {
	prov.mu.RLock()
	defer prov.mu.RUnlock()

	return prov.d.Permission(ctx, req)
}
