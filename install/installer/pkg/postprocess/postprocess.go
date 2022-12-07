// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package postprocess

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	openvsxproxy "github.com/gitpod-io/gitpod/installer/pkg/components/openvsx-proxy"
	"github.com/gitpod-io/gitpod/installer/pkg/yq"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/pointer"
)

// Processors list of processes executed on each resource document
var Processors = []Processor{
	// Remove "status" from root of all network policies
	{
		Type:       common.TypeMetaNetworkPolicy,
		Expression: "del(.status)",
	},
	// Remove "status" from root of OpenVSXProxy stateful sets
	{
		Type:       common.TypeMetaStatefulSet,
		Expression: "del(.status)",
		Name:       pointer.String(openvsxproxy.Component),
	},
}

type Processor struct {
	Type       metav1.TypeMeta
	Expression string
	Name       *string // Optional
}

func useProcessor(object common.RuntimeObject, processor Processor) bool {
	if object.APIVersion == processor.Type.APIVersion && object.Kind == processor.Type.Kind {
		// Name is optional
		if processor.Name == nil {
			// Name not specified - return
			return true
		}

		// Name specified - match
		return object.Metadata.Name == *processor.Name
	}

	return false
}

func Run(objects []common.RuntimeObject) ([]common.RuntimeObject, error) {
	result := make([]common.RuntimeObject, 0)

	for _, o := range objects {
		for _, p := range Processors {
			if useProcessor(o, p) {
				output, err := yq.Process(o.Content, p.Expression)
				if err != nil {
					return nil, err
				}
				o.Content = *output
			}
		}

		result = append(result, o)
	}

	return result, nil
}
