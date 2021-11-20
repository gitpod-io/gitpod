// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func podsecuritypolicies(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{
		&policyv1.PodSecurityPolicy{
			TypeMeta: common.TypeMetaPodSecurityPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-ns-workspace", ctx.Namespace),
				Namespace: ctx.Namespace,
				Annotations: map[string]string{
					"seccomp.security.alpha.kubernetes.io/allowedProfileNames": "*",
					"apparmor.security.beta.kubernetes.io/allowedProfileNames": "runtime/default,unconfined",
					"seccomp.security.alpha.kubernetes.io/defaultProfileName":  "runtime/default",
					"apparmor.security.beta.kubernetes.io/defaultProfileName":  "runtime/default",
				},
			},
			Spec: policyv1.PodSecurityPolicySpec{
				Privileged:               false,
				AllowPrivilegeEscalation: pointer.Bool(true),
				AllowedCapabilities:      []corev1.Capability{"AUDIT_WRITE", "FSETID", "KILL", "NET_BIND_SERVICE", "SYS_PTRACE"},
				Volumes:                  []policyv1.FSType{policyv1.ConfigMap, policyv1.Projected, policyv1.Secret, policyv1.HostPath},
				HostNetwork:              false,
				HostIPC:                  false,
				HostPID:                  false,
				RunAsUser:                policyv1.RunAsUserStrategyOptions{Rule: policyv1.RunAsUserStrategyRunAsAny},
				SELinux:                  policyv1.SELinuxStrategyOptions{Rule: policyv1.SELinuxStrategyRunAsAny},
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
		},
	}, nil
}
