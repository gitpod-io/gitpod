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

	switch {
	case w.Field != "":
		return w.writeField(tw, v)
	case w.LongFormat:
		return w.writeLongFormat(tw, v)
	default:
		return w.writeShortFormat(tw, v)
	}
}

// writeField writes a single field of the given tabular data to the writer
func (w Writer) writeField(tw *tabwriter.Writer, v Tabular) error {
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
	return nil
}

// writeLongFormat writes the given tabular data to the writer in a long format
func (w Writer) writeLongFormat(tw *tabwriter.Writer, v Tabular) error {
	for _, row := range v.Row() {
		for _, h := range v.Header() {
			fieldName := Capitalize(h)
			fieldName = strings.ReplaceAll(fieldName, "id", "ID")

			_, err := tw.Write([]byte(fmt.Sprintf("%s:\t%s\n", fieldName, row[h])))
			if err != nil {
				return err
			}
		}
		_, err := tw.Write([]byte("\n"))
		if err != nil {
			return err
		}
	}
	return nil
}

// writeShortFormat writes the given tabular data to the writer in a short format
func (w Writer) writeShortFormat(tw *tabwriter.Writer, v Tabular) error {
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

// Capitalize capitalizes the first letter of the given string
func Capitalize(s string) string {
	if s == "" {
		return ""
	}
	if len(s) == 1 {
		return strings.ToUpper(s)
	}

	return strings.ToUpper(s[0:1]) + s[1:]
}

// // Format formats the given input string by interpreting HTML tags in the string. Specifically it supports
// //
// //	<b>bold</b>
// //	<i>italic</i>
// //	<u>underline</u>
// //	<color=...></color>
// func Format(input string) string {
// 	input = regexpBold.ReplaceAllString(input, "\033[1m$1\033[0m")
// 	input = regexpItalic.ReplaceAllString(input, "\033[3m$1\033[0m")
// 	input = regexpUnderline.ReplaceAllString(input, "\033[4m$1\033[0m")

// 	input = regexpColor.ReplaceAllStringFunc(input, func(s string) string {
// 		parts := regexpColor.FindStringSubmatch(s)
// 		if len(parts) != 3 {
// 			return s
// 		}

// 		col := parts[1]
// 		text := parts[2]

// 		return fmt.Sprintf("\033[%sm%s\033[0m", color, text)
// 	})

// 	return input
// }

// var (
// 	regexpColor     = regexp.MustCompile(`<color=(.*?)>(.*?)</color>`)
// 	regexpBold      = regexp.MustCompile(`<b>(.*?)</b>`)
// 	regexpItalic    = regexp.MustCompile(`<i>(.*?)</i>`)
// 	regexpUnderline = regexp.MustCompile(`<u>(.*?)</u>`)
// )
