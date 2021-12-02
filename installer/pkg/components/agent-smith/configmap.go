// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package agentsmith

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	ascfg := config.ServiceConfig{
		PProfAddr:      fmt.Sprintf("localhost:%d", PProfPort),
		PrometheusAddr: fmt.Sprintf("localhost:%d", PrometheusPort),
		HostURL:        fmt.Sprintf("https://%s", ctx.Config.Domain),
		Config: config.Config{
			Blocklists: &config.Blocklists{
				Very: &config.PerLevelBlocklist{
					Signatures: []*classifier.Signature{{
						Name:    "testtarget",
						Domain:  classifier.DomainProcess,
						Kind:    classifier.ObjectELFSymbols,
						Pattern: []byte(base64.StdEncoding.EncodeToString([]byte("agentSmithTestTarget"))),
						Regexp:  false,
					}},
				},
			},
			EgressTraffic: &config.EgressTraffic{
				WindowDuration: util.Duration(time.Minute * 2),
				ExcessiveLevel: &config.PerLevelEgressTraffic{
					BaseBudget: resource.MustParse("300Mi"),
					Threshold:  resource.MustParse("100Mi"),
				},
				VeryExcessiveLevel: &config.PerLevelEgressTraffic{
					BaseBudget: resource.MustParse("2Gi"),
					Threshold:  resource.MustParse("250Mi"),
				},
			},
			Kubernetes: config.Kubernetes{Enabled: true},
		},
	}

	fc, err := json.MarshalIndent(ascfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal agent-smith config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component, ctx),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
