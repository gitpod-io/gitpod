// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package agentsmith

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/agent"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/signature"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"time"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	ascfg := config.ServiceConfig{
		PProfAddr:      "localhost:6060",
		PrometheusAddr: "localhost:9500",
		HostURL:        fmt.Sprintf("https://%s", ctx.Config.Domain),
		Config: agent.Config{
			Blacklists: &agent.Blacklists{
				Very: &agent.PerLevelBlacklist{
					Signatures: []*signature.Signature{{
						Name:    "testtarget",
						Domain:  signature.DomainProcess,
						Kind:    signature.ObjectELF,
						Pattern: []byte(base64.StdEncoding.EncodeToString([]byte("agentSmithTestTarget"))),
						Regexp:  false,
					}},
				},
			},
			EgressTraffic: &agent.EgressTraffic{
				WindowDuration: util.Duration(time.Minute * 2),
				ExcessiveLevel: &agent.PerLevelEgressTraffic{
					BaseBudget: resource.MustParse("300Mi"),
					Threshold:  resource.MustParse("100Mi"),
				},
				VeryExcessiveLevel: &agent.PerLevelEgressTraffic{
					BaseBudget: resource.MustParse("2Gi"),
					Threshold:  resource.MustParse("250Mi"),
				},
			},
			Kubernetes: agent.Kubernetes{Enabled: true},
		},
	}

	fc, err := json.MarshalIndent(ascfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal agent-smith config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaNetworkPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
