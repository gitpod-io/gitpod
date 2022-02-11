// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/api/policy/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func podsecuritypolicies(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{
		&v1beta1.PodSecurityPolicy{
			TypeMeta: common.TypeMetaPodSecurityPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-ns-privileged", ctx.Namespace),
				Namespace: ctx.Namespace,
				Annotations: map[string]string{
					"apparmor.security.beta.kubernetes.io/allowedProfileNames": "runtime/default",
					"apparmor.security.beta.kubernetes.io/defaultProfileName":  "runtime/default",
					"seccomp.security.alpha.kubernetes.io/allowedProfileNames": "runtime/default",
					"seccomp.security.alpha.kubernetes.io/defaultProfileName":  "runtime/default",
				},
			},
			Spec: v1beta1.PodSecurityPolicySpec{
				Privileged:               true,
				AllowPrivilegeEscalation: pointer.Bool(true),
				AllowedCapabilities:      []corev1.Capability{"*"},
				Volumes:                  []v1beta1.FSType{v1beta1.All},
				HostNetwork:              true,
				HostPorts: []v1beta1.HostPortRange{{
					Min: 0,
					Max: 65535,
				}},
				HostIPC:            true,
				HostPID:            true,
				RunAsUser:          v1beta1.RunAsUserStrategyOptions{Rule: v1beta1.RunAsUserStrategyRunAsAny},
				SELinux:            v1beta1.SELinuxStrategyOptions{Rule: v1beta1.SELinuxStrategyRunAsAny},
				SupplementalGroups: v1beta1.SupplementalGroupsStrategyOptions{Rule: v1beta1.SupplementalGroupsStrategyRunAsAny},
				FSGroup:            v1beta1.FSGroupStrategyOptions{Rule: v1beta1.FSGroupStrategyRunAsAny},
			},
		},
		&v1beta1.PodSecurityPolicy{
			TypeMeta: common.TypeMetaPodSecurityPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-ns-privileged-unconfined", ctx.Namespace),
				Namespace: ctx.Namespace,
				Annotations: map[string]string{
					"apparmor.security.beta.kubernetes.io/allowedProfileNames": "unconfined",
					"apparmor.security.beta.kubernetes.io/defaultProfileName":  "unconfined",
					"seccomp.security.alpha.kubernetes.io/allowedProfileNames": "runtime/default,unconfined",
					"seccomp.security.alpha.kubernetes.io/defaultProfileName":  "runtime/default",
				},
			},
			Spec: v1beta1.PodSecurityPolicySpec{
				Privileged:               true,
				AllowPrivilegeEscalation: pointer.Bool(true),
				AllowedCapabilities:      []corev1.Capability{"*"},
				Volumes:                  []v1beta1.FSType{v1beta1.All},
				HostNetwork:              false,
				HostPorts: []v1beta1.HostPortRange{{
					Min: 0,
					Max: 65535,
				}},
				HostIPC:            false,
				HostPID:            true,
				RunAsUser:          v1beta1.RunAsUserStrategyOptions{Rule: v1beta1.RunAsUserStrategyRunAsAny},
				SELinux:            v1beta1.SELinuxStrategyOptions{Rule: v1beta1.SELinuxStrategyRunAsAny},
				SupplementalGroups: v1beta1.SupplementalGroupsStrategyOptions{Rule: v1beta1.SupplementalGroupsStrategyRunAsAny},
				FSGroup:            v1beta1.FSGroupStrategyOptions{Rule: v1beta1.FSGroupStrategyRunAsAny},
			},
		},
		&v1beta1.PodSecurityPolicy{
			TypeMeta: common.TypeMetaPodSecurityPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-ns-restricted-root-user", ctx.Namespace),
				Namespace: ctx.Namespace,
				Annotations: map[string]string{
					"seccomp.security.alpha.kubernetes.io/allowedProfileNames": "runtime/default",
					"apparmor.security.beta.kubernetes.io/allowedProfileNames": "runtime/default",
					"seccomp.security.alpha.kubernetes.io/defaultProfileName":  "runtime/default",
					"apparmor.security.beta.kubernetes.io/defaultProfileName":  "runtime/default",
				},
			},
			Spec: v1beta1.PodSecurityPolicySpec{
				Privileged: true,
				Volumes: []v1beta1.FSType{
					v1beta1.ConfigMap,
					v1beta1.Projected,
					v1beta1.Secret,
					v1beta1.EmptyDir,
					v1beta1.PersistentVolumeClaim,
					v1beta1.HostPath,
				},
				HostNetwork: true,
				HostPorts: []v1beta1.HostPortRange{{
					Min: 30000,
					Max: 33000,
				}},
				HostIPC:   false,
				HostPID:   false,
				RunAsUser: v1beta1.RunAsUserStrategyOptions{Rule: v1beta1.RunAsUserStrategyRunAsAny},
				SELinux:   v1beta1.SELinuxStrategyOptions{Rule: v1beta1.SELinuxStrategyRunAsAny},
				SupplementalGroups: v1beta1.SupplementalGroupsStrategyOptions{
					Rule: v1beta1.SupplementalGroupsStrategyMustRunAs,
					Ranges: []v1beta1.IDRange{{
						Min: 1,
						Max: 65535,
					}},
				},
				FSGroup: v1beta1.FSGroupStrategyOptions{
					Rule: v1beta1.FSGroupStrategyMustRunAs,
					Ranges: []v1beta1.IDRange{{
						Min: 1,
						Max: 65535,
					}},
				},
				ReadOnlyRootFilesystem: false,
			},
		},
		&v1beta1.PodSecurityPolicy{
			TypeMeta: common.TypeMetaPodSecurityPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-ns-unprivileged", ctx.Namespace),
				Namespace: ctx.Namespace,
				Annotations: map[string]string{
					"seccomp.security.alpha.kubernetes.io/allowedProfileNames": "runtime/default",
					"apparmor.security.beta.kubernetes.io/allowedProfileNames": "runtime/default",
					"seccomp.security.alpha.kubernetes.io/defaultProfileName":  "runtime/default",
					"apparmor.security.beta.kubernetes.io/defaultProfileName":  "runtime/default",
				},
			},
			Spec: v1beta1.PodSecurityPolicySpec{
				Privileged:               false,
				AllowPrivilegeEscalation: pointer.Bool(false),
				RequiredDropCapabilities: []corev1.Capability{"ALL"},
				Volumes: []v1beta1.FSType{
					v1beta1.ConfigMap,
					v1beta1.EmptyDir,
					v1beta1.Projected,
					v1beta1.Secret,
					v1beta1.PersistentVolumeClaim,
				},
				HostNetwork: false,
				HostIPC:     false,
				HostPID:     false,
				RunAsUser:   v1beta1.RunAsUserStrategyOptions{Rule: v1beta1.RunAsUserStrategyMustRunAsNonRoot},
				SELinux:     v1beta1.SELinuxStrategyOptions{Rule: v1beta1.SELinuxStrategyRunAsAny},
				SupplementalGroups: v1beta1.SupplementalGroupsStrategyOptions{
					Rule: v1beta1.SupplementalGroupsStrategyMustRunAs,
					Ranges: []v1beta1.IDRange{{
						Min: 1,
						Max: 65535,
					}},
				},
				FSGroup: v1beta1.FSGroupStrategyOptions{
					Rule: v1beta1.FSGroupStrategyMustRunAs,
					Ranges: []v1beta1.IDRange{{
						Min: 1,
						Max: 65535,
					}},
				},
				ReadOnlyRootFilesystem: false,
			},
		},
	}, nil
}
