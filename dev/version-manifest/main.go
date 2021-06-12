// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type MD struct {
	HelmComponent string `yaml:"helm-component"`
}

func main() {
	produceManifest(os.Stdout, os.DirFS("."))
}

func produceManifest(out io.Writer, dir fs.FS) error {
	mds, err := fs.Glob(dir, "**/metadata.yaml")
	if err != nil {
		return err
	}
	versions := make(map[string]string)
	for _, md := range mds {
		b, err := fs.ReadFile(dir, md)
		if err != nil {
			return err
		}
		var mdobj MD
		err = yaml.Unmarshal(b, &mdobj)
		if err != nil {
			return fmt.Errorf("cannot unmarshal %s: %w", md, err)
		}
		if mdobj.HelmComponent == "" {
			continue
		}

		imgf, err := fs.ReadFile(dir, filepath.Join(filepath.Dir(md), "imgnames.txt"))
		if err != nil {
			return fmt.Errorf("cannot read image names for %s: %w", md, err)
		}
		imgs := strings.Split(strings.TrimSpace(string(imgf)), "\n")
		img := imgs[len(imgs)-1]
		segs := strings.Split(img, ":")
		if len(segs) != 2 {
			return fmt.Errorf("invalid image format: %s", img)
		}
		version := segs[1]
		versions[mdobj.HelmComponent] = version
	}

	keys := make([]string, 0, len(versions))
	for v := range versions {
		keys = append(keys, v)
	}
	sort.Strings(keys)

	fmt.Fprintln(out, "components:")
	for _, v := range keys {
		img := versions[v]
		segs := strings.Split(v, ".")
		for i, s := range segs {
			fmt.Fprintf(out, "%s%s:", strings.Repeat("  ", i+1), s)
			if i == len(segs)-1 {
				fmt.Fprintf(out, "\n%sversion: %s\n", strings.Repeat("  ", i+2), img)
			} else {
				fmt.Fprintln(out)
			}
		}
		fmt.Fprintln(out)
	}

	return nil
}
