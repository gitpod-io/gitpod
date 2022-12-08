// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registryfacade

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	"k8s.io/api/policy/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func podsecuritypolicy(ctx *common.RenderContext) ([]runtime.Object, error) {
	var resources []runtime.Object

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.Common != nil && cfg.Common.UsePodSecurityPolicies {
			resources = append(resources, &v1beta1.PodSecurityPolicy{
				TypeMeta: common.TypeMetaPodSecurityPolicy,
				ObjectMeta: metav1.ObjectMeta{
					Name:   fmt.Sprintf("%s-ns-%s", ctx.Namespace, Component),
					Labels: common.DefaultLabels(Component),
					Annotations: map[string]string{
						"seccomp.security.alpha.kubernetes.io/allowedProfileNames": "runtime/default",
						"apparmor.security.beta.kubernetes.io/allowedProfileNames": "runtime/default",
						"seccomp.security.alpha.kubernetes.io/defaultProfileName":  "runtime/default",
						"apparmor.security.beta.kubernetes.io/defaultProfileName":  "runtime/default",
					},
				},
				Spec: v1beta1.PodSecurityPolicySpec{
					Volumes: []v1beta1.FSType{
						v1beta1.ConfigMap,
						v1beta1.Secret,
						v1beta1.EmptyDir,
						v1beta1.HostPath,
					},
					HostNetwork: true,
					HostIPC:     false,
					HostPID:     false,
					HostPorts: []v1beta1.HostPortRange{
						{
							Min: 20000,
							Max: 20000,
						},
					},
					RunAsUser: v1beta1.RunAsUserStrategyOptions{
						Rule: v1beta1.RunAsUserStrategyRunAsAny,
					},
					SELinux: v1beta1.SELinuxStrategyOptions{
						Rule: v1beta1.SELinuxStrategyRunAsAny,
					},
					SupplementalGroups: v1beta1.SupplementalGroupsStrategyOptions{
						Rule: v1beta1.SupplementalGroupsStrategyMustRunAs,
						Ranges: []v1beta1.IDRange{
							{
								Min: 1,
								Max: 65535,
							},
						},
					},
					FSGroup: v1beta1.FSGroupStrategyOptions{
						Rule: v1beta1.FSGroupStrategyMustRunAs,
						Ranges: []v1beta1.IDRange{
							{
								Min: 1,
								Max: 65535,
							},
						},
					},
					ReadOnlyRootFilesystem: false,
				},
			})
		}
		return nil
	})

	return resources, nil
}
