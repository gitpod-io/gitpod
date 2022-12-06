// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry_credential

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

func secret(ctx *common.RenderContext) ([]runtime.Object, error) {
	accessKey := ctx.Values.StorageAccessKey
	if accessKey == "" {
		return nil, fmt.Errorf("unknown value: access key")
	}

	secretKey := ctx.Values.StorageSecretKey
	if secretKey == "" {
		return nil, fmt.Errorf("unknown value: secret key")
	}

	region := ctx.Values.Region
	if region == "" {
		return nil, fmt.Errorf("unknown value: region")
	}

	commonLabels := common.DefaultLabels(Component)

	// copy a map
	ecrLabels := make(map[string]string)
	for k, v := range commonLabels {
		ecrLabels[k] = v
	}
	ecrLabels["aws-ecr-updater"] = "true"

	return []runtime.Object{
		// IAM user credentials
		&corev1.Secret{
			TypeMeta: common.TypeMetaSecret,
			ObjectMeta: metav1.ObjectMeta{
				Name:      SecretNameAWSIAMUserCredentials,
				Namespace: ctx.Namespace,
				Labels:    commonLabels,
			},
			StringData: map[string]string{
				"access_key_id":     accessKey,
				"secret_access_key": secretKey,
			},
		},
		// ECR credentials
		&corev1.Secret{
			TypeMeta: common.TypeMetaSecret,
			ObjectMeta: metav1.ObjectMeta{
				Name:      "aws-ecr-credentials",
				Namespace: ctx.Namespace,
				Labels:    ecrLabels,
				Annotations: map[string]string{
					"aws-ecr-updater/secret": SecretNameAWSIAMUserCredentials,
					"aws-ecr-updater/region": region,
				},
			},
			Type: corev1.SecretTypeDockerConfigJson,
			StringData: map[string]string{
				".dockerconfigjson": "{}",
			},
		},
	}, nil
}
