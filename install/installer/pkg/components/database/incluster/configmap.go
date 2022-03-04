// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package incluster

import (
	"embed"
	"fmt"
	"io/fs"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

//go:embed init/*.sql
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
		// Replace variables in the script
		fileStr = strings.Replace(fileStr, "__GITPOD_DB_NAME__", Database, -1)
		fileStr = strings.Replace(fileStr, "__GITPOD_USERNAME__", Username, -1)

		// Add the file name for debugging purposes
		initScriptData += fmt.Sprintf("-- %s\n\n%s", script.Name(), fileStr)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      SQLInitScripts,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"init.sql":      initScriptData,
				"tuneMysql.sql": `SET GLOBAL innodb_lru_scan_depth=256;`,
			},
		},
	}, nil
}
