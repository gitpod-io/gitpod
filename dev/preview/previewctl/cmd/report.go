// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"

	"text/template"
)

var tmplString = `
<p>Gitpod was successfully deployed to your preview environment.</p>
<ul>
	<li><b>🏷️ Name</b> - {{ .Name }}</li>
	<li><b>🔗 URL</b> - <a href="https://{{ .Name }}.preview.gitpod-dev.com/workspaces" target="_blank">{{ .Name }}.preview.gitpod-dev.com/workspaces</a>.</li>
	<li><b>📚 Documentation</b> - See our <a href="https://www.notion.so/gitpod/6debd359591b43688b52f76329d04010#7c1ce80ab31a41e29eff2735e38eec39" target="_blank">internal documentation</a> for information on how to interact with your preview environment.</li>
	<li><b>📦 Version</b> - {{ .Version }}</li>
	<li><b>🗒️ Logs</b> - <a href="https://console.cloud.google.com/logs/query;query=jsonPayload.kubernetes.host%3D%22preview-{{ .Name }}%22%0A%0A--%20Filter%20on%20service:%0A--%20jsonPayload.serviceContext.service%3D%22ws-manager-mk2%22%0A;duration=P1D?project=gitpod-dev-preview" target="_blank">GCP Logs Explorer</a></li>
</ul>
`

func newReportNameCmd() *cobra.Command {
	var version string
	cmd := &cobra.Command{
		Use:   "report",
		Short: "Writes an HTML report to stdout with information about the current preview environment.",
		RunE: func(cmd *cobra.Command, args []string) error {
			previewName, err := preview.GetName(branch)
			if err != nil {
				return err
			}

			tmpl, _ := template.New("Report").Parse(strings.TrimSpace(strings.ReplaceAll(tmplString, "'", "`")))

			vars := make(map[string]interface{})
			vars["Name"] = previewName
			vars["Url"] = previewName
			vars["Version"] = version

			err = tmpl.Execute(os.Stdout, vars)
			if err != nil {
				return err
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&version, "installer-version", os.Getenv("VERSION"), "Deployed installer version")

	return cmd
}
