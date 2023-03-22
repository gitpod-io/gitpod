// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package extender

import (
	"fmt"

	v1 "k8s.io/api/core/v1"
	extender_v1 "k8s.io/kube-scheduler/extender/v1"
)

type Predicate struct {
	Name string
	Func func(pod v1.Pod, node v1.Node) (bool, error)
}

func (p Predicate) Handler(args extender_v1.ExtenderArgs) *extender_v1.ExtenderFilterResult {
	pod := args.Pod
	canSchedule := make([]v1.Node, 0, len(args.Nodes.Items))
	canNotSchedule := make(map[string]string)

	for _, node := range args.Nodes.Items {
		okToSchedule, err := p.Func(*pod, node)
		if err != nil {
			canNotSchedule[node.Name] = err.Error()
			continue
		}

		if okToSchedule {
			canSchedule = append(canSchedule, node)
			continue
		}

		canNotSchedule[node.Name] = fmt.Sprintf("cannot schedule pod %v in node %v", pod.Name, node.Name)
	}

	result := extender_v1.ExtenderFilterResult{
		Nodes: &v1.NodeList{
			Items: canSchedule,
		},
		FailedAndUnresolvableNodes: canNotSchedule,
		Error:                      "",
	}

	return &result
}
