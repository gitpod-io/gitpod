// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package prettyprint

import (
	"bytes"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestWriterWrite(t *testing.T) {
	type R struct {
		Foo      string `print:"foo"`
		Number   int    `print:"number"`
		DiffName string `print:"foobar"`
	}
	type Expectation struct {
		Error string
		Out   string
	}
	tests := []struct {
		Name        string
		Expectation Expectation
		Format      WriterFormat
		Field       string
		Data        []R
	}{
		{
			Name: "wide format with data",
			Expectation: Expectation{
				Out: "FOO NUMBER FOOBAR \nfoo 42     bar    \n",
			},
			Format: WriterFormatWide,
			Data: []R{
				{Foo: "foo", Number: 42, DiffName: "bar"},
			},
		},
		{
			Name: "narrow format with data",
			Expectation: Expectation{
				Out: "Foo:    foo\nNumber: 42\nFoobar: bar\n",
			},
			Format: WriterFormatNarrow,
			Data: []R{
				{Foo: "foo", Number: 42, DiffName: "bar"},
			},
		},
		{
			Name: "empty",
			Expectation: Expectation{
				Out: "",
			},
			Format: WriterFormatNarrow,
			Field:  "",
			Data:   nil,
		},
		{
			Name: "empty wide",
			Expectation: Expectation{
				Out: "FOO NUMBER FOOBAR \n",
			},
			Format: WriterFormatWide,
		},
		{
			Name:        "empty field",
			Expectation: Expectation{},
			Format:      WriterFormatNarrow,
			Field:       "foo",
			Data:        nil,
		},
		{
			Name:        "empty field wide",
			Expectation: Expectation{},
			Format:      WriterFormatWide,
			Field:       "foo",
			Data:        nil,
		},
		{
			Name:        "empty field with data",
			Expectation: Expectation{},
			Format:      WriterFormatNarrow,
			Field:       "foo",
			Data:        []R{{}},
		},
		{
			Name:        "empty field with data wide",
			Expectation: Expectation{},
			Format:      WriterFormatWide,
			Field:       "foo",
			Data:        []R{{}},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation

			out := bytes.NewBuffer(nil)
			w := Writer[R]{
				Out:    out,
				Format: test.Format,
				Field:  test.Field,
			}
			err := w.Write(test.Data)
			if err != nil {
				act.Error = err.Error()
			}
			act.Out = out.String()

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("Write() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
