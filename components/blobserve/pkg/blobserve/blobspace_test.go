// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func Test_diskBlobspace_modifyFile(t *testing.T) {
	type Args struct {
		blobName string
		filename string
		mod      FileModifier
	}
	tests := []struct {
		Name     string
		Args     Args
		Expected string
	}{
		{
			Name: "replace content",
			Args: Args{
				blobName: "b1",
				filename: "f1",
				mod: func(in io.Reader, out io.Writer) error {
					_, err := out.Write([]byte("foo"))
					return err
				},
			},
			Expected: "foo",
		},
	}
	for _, tt := range tests {
		t.Run(tt.Name, func(t *testing.T) {
			tmp, err := ioutil.TempDir("", "")
			if err != nil {
				t.Fatal(err)
			}
			defer os.RemoveAll(tmp)

			os.MkdirAll(filepath.Join(tmp, "b1"), 0755)
			ioutil.WriteFile(filepath.Join(tmp, "b1", "f1"), []byte("hello world"), 0600)

			b := &diskBlobspace{
				Location: tmp,
			}
			err = b.modifyFile(tt.Args.blobName, tt.Args.filename, tt.Args.mod)
			if err != nil {
				t.Fatal(err)
			}

			ctnt, err := ioutil.ReadFile(filepath.Join(tmp, "b1", "f1"))
			if err != nil {
				t.Fatal(err)
			}
			if diff := cmp.Diff(tt.Expected, string(ctnt)); diff != "" {
				t.Errorf("modifyFile() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func Test_modifySearchAndReplace(t *testing.T) {
	type args struct {
		Search  string
		Replace string
	}
	tests := []struct {
		Name     string
		Args     args
		Input    string
		Expected string
	}{
		{
			Name: "happy path",
			Args: args{
				Search:  "foobar",
				Replace: "baz",
			},
			Input:    "hello world\nthis is foobar\ncool beans",
			Expected: "hello world\nthis is baz\ncool beans",
		},
		{
			Name: "across lines",
			Args: args{
				Search:  "foo\nbar",
				Replace: "baz",
			},
			Input:    "hello world\nthis is foo\nbar\ncool beans",
			Expected: "hello world\nthis is baz\ncool beans",
		},
	}
	for _, tt := range tests {
		t.Run(tt.Name, func(t *testing.T) {
			buf := bytes.NewBuffer(nil)
			err := modifySearchAndReplace(tt.Args.Search, tt.Args.Replace)(bytes.NewReader([]byte(tt.Input)), buf)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(tt.Expected, buf.String()); diff != "" {
				t.Errorf("modifySearchAndReplace() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func Test_inlineVars(t *testing.T) {
	tests := []struct {
		Name         string
		InlineVars   *BlobserveInlineVars
		Replacements []InlineReplacement
		Content      string
		Expected     string
	}{
		{
			Name: "no replacements",
			InlineVars: &BlobserveInlineVars{
				IDE:             "foo",
				SupervisorImage: "bar",
			},
			Content:  "aaa\nbbb\n",
			Expected: "aaa\nbbb\n",
		},
		{
			Name: "no inline vars",
			Replacements: []InlineReplacement{
				{Search: "aaa", Replacement: "${ide}"},
				{Search: "bbb", Replacement: "${supervisor}"},
			},
			Content:  "aaa\nbbb\n",
			Expected: "aaa\nbbb\n",
		},
		{
			Name: "happy",
			InlineVars: &BlobserveInlineVars{
				IDE:             "foo",
				SupervisorImage: "bar",
			},
			Replacements: []InlineReplacement{
				{Search: "aaa", Replacement: "${ide}"},
				{Search: "bbb", Replacement: "${supervisor}"},
			},
			Content:  "aaa\nbbb\n",
			Expected: "foo\nbar\n",
		},
	}
	for _, tt := range tests {
		t.Run(tt.Name, func(t *testing.T) {
			req := &http.Request{}
			if tt.InlineVars != nil {
				value, err := json.Marshal(tt.InlineVars)
				if err != nil {
					t.Fatal(err)
				}
				req.Header = make(http.Header)
				req.Header.Add("X-BlobServe-InlineVars", string(value))
			}
			content, err := inlineVars(req, bytes.NewReader([]byte(tt.Content)), tt.Replacements)
			if err != nil {
				t.Fatal(err)
			}
			result, err := io.ReadAll(content)
			if err != nil {
				t.Fatal(err)
			}
			if diff := cmp.Diff(tt.Expected, string(result)); diff != "" {
				t.Errorf("inlineVars() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
