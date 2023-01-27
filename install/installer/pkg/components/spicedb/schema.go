// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

import (
	"embed"
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

//go:embed data/*.yaml
var bootstrapFiles embed.FS

func bootstrap(ctx *common.RenderContext) ([]runtime.Object, error) {

	files, err := getBootstrapFiles()
	if err != nil {
		return nil, fmt.Errorf("failed to read bootstrap files: %w", err)
	}

	cmData := make(map[string]string)
	for _, f := range files {
		cmData[f.name] = f.data
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

func getBootstrapConfig(ctx *common.RenderContext) (corev1.Volume, corev1.VolumeMount, []string, error) {
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

	files, err := getBootstrapFiles()
	if err != nil {
		return corev1.Volume{}, corev1.VolumeMount{}, nil, fmt.Errorf("failed to get bootstrap files: %w", err)
	}

	for _, f := range files {
		paths = append(paths, filepath.Join(mountPath, f.name))
	}

	return volume, mount, paths, nil
}

type file struct {
	name string
	data string
}

func getBootstrapFiles() ([]file, error) {
	files, err := fs.ReadDir(bootstrapFiles, "data")
	if err != nil {
		return nil, fmt.Errorf("failed to read bootstrap files: %w", err)
	}

	var filesWithContents []file
	for _, f := range files {
		b, err := fs.ReadFile(bootstrapFiles, fmt.Sprintf("%s/%s", "data", f.Name()))
		if err != nil {
			return nil, err
		}

		filesWithContents = append(filesWithContents, file{
			name: f.Name(),
			data: string(b),
		})
	}

	// ensure output is stable
	sort.Slice(filesWithContents, func(i, j int) bool {
		return strings.Compare(filesWithContents[i].name, filesWithContents[j].name) == -1
	})

	return filesWithContents, nil
}
