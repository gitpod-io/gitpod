// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registryfacade

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func podsecuritypolicy(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{&policyv1.PodSecurityPolicy{
		TypeMeta: common.TypeMetaPodSecurityPolicy,
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-ns-%s", ctx.Namespace, Component),
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
			Annotations: map[string]string{
				"seccomp.security.alpha.kubernetes.io/allowedProfileNames": "runtime/default",
				"apparmor.security.beta.kubernetes.io/allowedProfileNames": "runtime/default",
				"seccomp.security.alpha.kubernetes.io/defaultProfileName":  "runtime/default",
				"apparmor.security.beta.kubernetes.io/defaultProfileName":  "runtime/default",
			},
		},
		Spec: policyv1.PodSecurityPolicySpec{
			Volumes: []policyv1.FSType{
				policyv1.ConfigMap,
				policyv1.Secret,
				policyv1.EmptyDir,
				policyv1.HostPath,
			},
			HostNetwork: true,
			HostIPC:     false,
			HostPID:     false,
			HostPorts: []policyv1.HostPortRange{{
				Min: 30000,
				Max: 33000,
			}},
			RunAsUser: policyv1.RunAsUserStrategyOptions{
				Rule: policyv1.RunAsUserStrategyRunAsAny,
			},
			SELinux: policyv1.SELinuxStrategyOptions{
				Rule: policyv1.SELinuxStrategyRunAsAny,
			},
			SupplementalGroups: policyv1.SupplementalGroupsStrategyOptions{
				Rule: policyv1.SupplementalGroupsStrategyMustRunAs,
				Ranges: []policyv1.IDRange{{
					Min: 1,
					Max: 65535,
				}},
			},
			FSGroup: policyv1.FSGroupStrategyOptions{
				Rule: policyv1.FSGroupStrategyMustRunAs,
				Ranges: []policyv1.IDRange{{
					Min: 1,
					Max: 65535,
				}},
			},
			ReadOnlyRootFilesystem: false,
		},
	}}, nil
}
