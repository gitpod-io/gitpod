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
