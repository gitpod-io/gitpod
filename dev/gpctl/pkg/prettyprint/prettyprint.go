// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package prettyprint

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"text/tabwriter"

	"github.com/Masterminds/sprig"
	"golang.org/x/xerrors"
	"k8s.io/client-go/util/jsonpath"
)

// Format defines how to print an object
type Format string

const (
	// StringFormat prints an object as repr string
	StringFormat Format = "string"

	// JSONPathFormat extracts info using jsonpath
	JSONPathFormat Format = "jsonpath"

	// TemplateFormat prints info using a Go template
	TemplateFormat Format = "tpl"

	// JSONFormat prints an object as JSON
	JSONFormat Format = "json"
)

type formatterFunc func(*Printer, interface{}) error

var formatter = map[Format]formatterFunc{
	StringFormat:   formatString,
	TemplateFormat: formatTemplate,
	JSONFormat:     formatJSON,
	JSONPathFormat: formatJSONPath,
}

func formatString(pp *Printer, obj interface{}) error {
	_, err := fmt.Fprintf(pp.Writer, "%s", obj)
	return err
}

func formatJSONPath(pp *Printer, obj interface{}) error {
	p := jsonpath.New("expr")
	if err := p.Parse(pp.Template); err != nil {
		return err
	}
	return p.Execute(pp.Writer, obj)
}

func formatTemplate(pp *Printer, obj interface{}) error {
	tmpl, err := template.New("prettyprint").Funcs(sprig.FuncMap()).Parse(pp.Template)
	if err != nil {
		return err
	}

	w := tabwriter.NewWriter(pp.Writer, 8, 8, 8, ' ', 0)
	if err := tmpl.Execute(w, obj); err != nil {
		return err
	}
	if err := w.Flush(); err != nil {
		return err
	}
	return nil
}

func formatJSON(pp *Printer, obj interface{}) error {
	enc := json.NewEncoder(pp.Writer)
	enc.SetIndent("", "  ")
	return enc.Encode(obj)
}

// Printer is pretty-printer
type Printer struct {
	Format   Format
	Writer   io.Writer
	Template string
}

// Print pretty-prints the content
func (pp *Printer) Print(obj interface{}) error {
	formatter, ok := formatter[pp.Format]
	if !ok {
		return xerrors.Errorf("Unknown format: %s", pp.Format)
	}

	return formatter(pp, obj)
}
