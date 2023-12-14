// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"path/filepath"

	spicedb_component "github.com/gitpod-io/gitpod/components/spicedb"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func bootstrap(ctx *common.RenderContext) ([]runtime.Object, error) {

	files, err := spicedb_component.GetBootstrapFiles()
	if err != nil {
		return nil, fmt.Errorf("failed to read bootstrap files: %w", err)
	}

	cmData := make(map[string]string)
	for _, f := range files {
		cmData[f.Name] = f.Data
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        BootstrapConfigMapName,
				Namespace:   ctx.Namespace,
				Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
			},
			Data: cmData,
		},
	}, nil
}

func getBootstrapConfig(ctx *common.RenderContext) (corev1.Volume, corev1.VolumeMount, []string, string, error) {
	var volume corev1.Volume
	var mount corev1.VolumeMount
	var paths []string

	mountPath := "/bootstrap"

	volume = corev1.Volume{
		Name: "spicedb-bootstrap",
		VolumeSource: corev1.VolumeSource{
			ConfigMap: &corev1.ConfigMapVolumeSource{
				LocalObjectReference: corev1.LocalObjectReference{
					Name: BootstrapConfigMapName,
				},
			},
		},
	}

	mount = corev1.VolumeMount{
		Name:      "spicedb-bootstrap",
		MountPath: mountPath,
		ReadOnly:  true,
	}

	files, err := spicedb_component.GetBootstrapFiles()
	if err != nil {
		return corev1.Volume{}, corev1.VolumeMount{}, nil, "", fmt.Errorf("failed to get bootstrap files: %w", err)
	}

	for _, f := range files {
		paths = append(paths, filepath.Join(mountPath, f.Name))
	}

	concatenated := ""
	for _, f := range files {
		concatenated += f.Data
	}

	hasher := sha256.New()
	hasher.Write([]byte(concatenated))
	hash := hex.EncodeToString(hasher.Sum(nil))

	return volume, mount, paths, hash, nil
}
