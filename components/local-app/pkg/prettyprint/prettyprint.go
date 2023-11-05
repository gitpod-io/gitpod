// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package prettyprint

import (
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"
	"text/tabwriter"

	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
)

func reflectTabular[T any](data []T) (header []string, rows []map[string]string, err error) {
	type field struct {
		Name  string
		Field *reflect.StructField
	}
	var fields []field

	var dt T
	t := reflect.TypeOf(dt)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return nil, nil, AddApology(fmt.Errorf("can only reflect tabular data from structs"))
	}
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		switch f.Type.Kind() {
		case reflect.String, reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		default:
			continue
		}
		name := f.Tag.Get("print")
		if name == "" {
			name = f.Name
		}
		fields = append(fields, field{Name: name, Field: &f})
		header = append(header, name)
	}

	rows = make([]map[string]string, 0, len(rows))
	for _, row := range data {
		r := make(map[string]string)
		for _, f := range fields {
			v := reflect.ValueOf(row)
			if v.Kind() == reflect.Ptr {
				v = v.Elem()
			}
			v = v.FieldByName(f.Field.Name)
			switch v.Kind() {
			case reflect.String:
				r[f.Name] = v.String()
			case reflect.Bool:
				r[f.Name] = FormatBool(v.Bool())
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				r[f.Name] = strconv.FormatInt(v.Int(), 10)
			}
		}
		rows = append(rows, r)
	}

	return header, rows, nil
}

type WriterFormat int

const (
	// WriterFormatWide makes the writer produce wide formatted output, e.g.
	// FIELD ONE  FIELD TWO  FIELD THREE
	// valueOne   valueTwo   valueThree
	// valueOne   valueTwo   valueThree
	WriterFormatWide WriterFormat = iota

	// WriterFormatNarrow makes the writer produce narrow formatted output, e.g.
	// Field: value
	WriterFormatNarrow
)

type Writer[T any] struct {
	Out    io.Writer
	Format WriterFormat
	Field  string
}

// Write writes the given tabular data to the writer
func (w Writer[T]) Write(data []T) error {
	header, rows, err := reflectTabular(data)
	if err != nil {
		return err
	}

	tw := tabwriter.NewWriter(w.Out, 0, 4, 1, ' ', 0)
	defer tw.Flush()

	switch {
	case w.Field != "":
		return w.writeField(tw, header, rows)
	case w.Format == WriterFormatNarrow:
		return w.writeNarrowFormat(tw, header, rows)
	default:
		return w.writeWideFormat(tw, header, rows)
	}
}

// writeField writes a single field of the given tabular data to the writer
func (w Writer[T]) writeField(tw *tabwriter.Writer, header []string, rows []map[string]string) error {
	var found bool
	for _, h := range header {
		if h == w.Field {
			found = true
			break
		}
	}
	if !found {
		return AddResolution(fmt.Errorf("unknown field: %s", w.Field), "use one of the following fields: "+strings.Join(header, ", "))
	}

	for _, row := range rows {
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

// writeNarrowFormat writes the given tabular data to the writer in a long format
func (w Writer[T]) writeNarrowFormat(tw *tabwriter.Writer, header []string, rows []map[string]string) error {
	for _, row := range rows {
		for _, h := range header {
			fieldName := Capitalize(h)
			fieldName = strings.ReplaceAll(fieldName, "id", "ID")

			_, err := tw.Write([]byte(fmt.Sprintf("%s:\t%s\n", fieldName, row[h])))
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// writeWideFormat writes the given tabular data to the writer in a short format
func (w Writer[T]) writeWideFormat(tw *tabwriter.Writer, header []string, rows []map[string]string) error {
	for _, h := range header {
		_, err := tw.Write([]byte(fmt.Sprintf("%s\t", strings.ToUpper(h))))
		if err != nil {
			return err
		}
	}
	_, _ = tw.Write([]byte("\n"))
	for _, row := range rows {
		for _, h := range header {
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
