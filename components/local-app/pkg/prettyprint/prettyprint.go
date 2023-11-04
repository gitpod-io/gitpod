// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package prettyprint

import (
	"fmt"
	"io"
	"strconv"
	"strings"
	"text/tabwriter"

	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
)

type Writer struct {
	Out        io.Writer
	LongFormat bool
	Field      string
}

// Write writes the given tabular data to the writer
func (w Writer) Write(v Tabular) error {
	tw := tabwriter.NewWriter(w.Out, 0, 4, 1, ' ', 0)
	defer tw.Flush()

	if w.Field != "" {
		var found bool
		hdr := v.Header()
		for _, h := range hdr {
			if h == w.Field {
				found = true
				break
			}
		}
		if !found {
			return AddResolution(fmt.Errorf("unknown field: %s", w.Field), "use one of the following fields: "+strings.Join(hdr, ", "))
		}

		for _, row := range v.Row() {
			val := row[w.Field]
			if val == "" {
				continue
			}
			_, err := tw.Write([]byte(fmt.Sprintf("%s\n", val)))
			if err != nil {
				return err
			}
		}
	} else if w.LongFormat {
		for _, row := range v.Row() {
			for _, h := range v.Header() {
				_, err := tw.Write([]byte(fmt.Sprintf("%s:\t%s\n", strings.ToUpper(h), row[h])))
				if err != nil {
					return err
				}
			}
			_, err := tw.Write([]byte("\n"))
			if err != nil {
				return err
			}
		}
	} else {
		for _, h := range v.Header() {
			_, err := tw.Write([]byte(fmt.Sprintf("%s\t", strings.ToUpper(h))))
			if err != nil {
				return err
			}
		}
		_, _ = tw.Write([]byte("\n"))
		for _, row := range v.Row() {
			for _, h := range v.Header() {
				_, err := tw.Write([]byte(fmt.Sprintf("%s\t", row[h])))
				if err != nil {
					return err
				}
			}
			_, err := tw.Write([]byte("\n"))
			if err != nil {
				return err
			}
		}
	}

	return nil
}

type Tabular interface {
	Header() []string
	Row() []map[string]string
}

// FormatBool returns "true" or "false" depending on the value of b.
func FormatBool(b bool) string {
	return strconv.FormatBool(b)
}

// FormatWorkspacePhase returns a user-facing representation of the given workspace phase
func FormatWorkspacePhase(phase v1.WorkspaceInstanceStatus_Phase) string {
	return strings.ToLower(strings.TrimPrefix(phase.String(), "PHASE_"))
}
