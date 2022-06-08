// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package expander

import (
	"context"
	"testing"

	apiv1 "k8s.io/api/core/v1"
	testprovider "k8s.io/autoscaler/cluster-autoscaler/cloudprovider/test"
	"k8s.io/autoscaler/cluster-autoscaler/expander/grpcplugin/protos"
	autoscaler_test "k8s.io/autoscaler/cluster-autoscaler/utils/test"

	_ "github.com/golang/mock/mockgen/model"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func TestExpander(t *testing.T) {
	n1 := autoscaler_test.BuildTestNode("n1", 1000, 1000)
	n2 := autoscaler_test.BuildTestNode("n2", 4000, 1000)
	n3 := autoscaler_test.BuildTestNode("n3", 4000, 1000)

	provider := testprovider.NewTestCloudProvider(nil, nil)

	provider.AddNodeGroup("node-group-1", 1, 10, 1)
	provider.AddNodeGroup("node-group-2", 1, 10, 1)
	provider.AddNodeGroup("node-group-3", 1, 10, 1)

	provider.AddNode("node-group-1", n1)
	provider.AddNode("node-group-2", n2)
	provider.AddNode("node-group-3", n3)

	p1 := autoscaler_test.BuildTestPod("p1", 1000, 0)
	p2 := autoscaler_test.BuildTestPod("p2", 500, 0)

	ng1, _ := provider.NodeGroupForNode(n1)
	ng2, _ := provider.NodeGroupForNode(n2)

	phantomNg, _ := provider.NodeGroupForNode(n3)

	nodeInfosForGroups := map[string]*apiv1.Node{
		"node-group-1": n1,
		"node-group-2": n2,
	}

	options := []*protos.Option{
		{
			NodeGroupId: ng1.Id(),
			NodeCount:   1,
			Pod:         []*apiv1.Pod{p1, p2},
			Debug:       "node-group-1",
		},
		{
			NodeGroupId: ng2.Id(),
			NodeCount:   1,
			Pod:         []*apiv1.Pod{p1},
			Debug:       "node-group-2",
		},
		{
			NodeGroupId: phantomNg.Id(),
			NodeCount:   1,
			Pod:         []*apiv1.Pod{p2},
			Debug:       "node-group-3",
		},
	}

	ae, _ := NewAutoscalerExpander(Config{
		WorkspaceClassPerNode: map[string]int{
			"node-group-1": 2,
			"node-group-2": 3,
		},
	}, nil)

	bestOption, _ := ae.BestOptions(context.Background(), &protos.BestOptionsRequest{
		Options: options,
		NodeMap: nodeInfosForGroups,
	})

	if diff := cmp.Diff(bestOption.Options, options, cmpopts.IgnoreUnexported(protos.Option{})); diff != "" {
		t.Errorf("unexpected option (-want +got):\n%s", diff)
	}
}
