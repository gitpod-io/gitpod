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

	"golang.org/x/xerrors"
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
			return xerrors.Errorf("cannot unmarshal %s: %w", md, err)
		}
		if mdobj.HelmComponent == "" {
			continue
		}

		imgf, err := fs.ReadFile(dir, filepath.Join(filepath.Dir(md), "imgnames.txt"))
		if err != nil {
			return xerrors.Errorf("cannot read image names for %s: %w", md, err)
		}
		imgs := strings.Split(strings.TrimSpace(string(imgf)), "\n")
		img := imgs[len(imgs)-1]
		segs := strings.Split(img, ":")
		if len(segs) != 2 {
			return xerrors.Errorf("invalid image format: %s", img)
		}
		version := segs[1]
		versions[mdobj.HelmComponent] = version
	}

	// We need to deduplicate keys in the resulting yaml file. To this end, we first build up
	// a map of maps and later print that map YAML style.
	res := make(map[string]interface{})
	comps := make(map[string]interface{})
	res["components"] = comps
	for k, v := range versions {
		var (
			m    = comps
			segs = strings.Split(k+".version", ".")
		)
		for i, seg := range segs {
			if i == len(segs)-1 {
				m[seg] = v
				continue
			}

			if _, ok := m[seg]; !ok {
				m[seg] = make(map[string]interface{})
			}
			m = m[seg].(map[string]interface{})
		}
	}

	// It's not clear how to maintain a stable order of keys using the YAML serializer.
	// If it were, we could just through this map at the YAML serializer and call it a day.
	// Right now, we have to produce the YAML ourselves.
	var print func(m map[string]interface{}, indent int) error
	print = func(m map[string]interface{}, indent int) error {
		keys := make([]string, 0, len(m))
		for v := range m {
			keys = append(keys, v)
		}
		sort.Strings(keys)

		for _, k := range keys {
			v := m[k]
			fmt.Fprintf(out, "%s%s:", strings.Repeat("  ", indent), k)
			if c, ok := v.(map[string]interface{}); ok {
				fmt.Fprintln(out)
				err := print(c, indent+1)
				if err != nil {
					return err
				}
				continue
			}
			if c, ok := v.(string); ok {
				fmt.Fprintf(out, " %s\n", c)
				fmt.Fprintln(out)
				continue
			}

			return xerrors.Errorf("unknown value type - this should never happen")
		}
		return nil
	}

	return print(res, 0)
}
