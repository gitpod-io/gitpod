// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package init

import (
	"embed"
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"io/fs"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

//go:embed files/*.sql
var initScriptFiles embed.FS

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	initScripts, err := fs.ReadDir(initScriptFiles, initScriptDir)
	if err != nil {
		return nil, err
	}

	initScriptData := ""

	for _, script := range initScripts {
		file, err := fs.ReadFile(initScriptFiles, fmt.Sprintf("%s/%s", initScriptDir, script.Name()))

		if err != nil {
			return nil, err
		}

		fileStr := string(file)

		// Add the file name for debugging purposes
		initScriptData += fmt.Sprintf("-- %s\n\n%s", script.Name(), fileStr)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      sqlInitScripts,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"init.sql": initScriptData,
			},
		},
	}, nil
}
