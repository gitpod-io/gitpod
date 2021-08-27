// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build ignore
// +build ignore

// Tabularasa tries to remove test fixtures which did no add to the code coverage. It removes every single fixture one by one,
// runes the tests and if the code coverage did not go down, it renames the file.
//
// To exempt a testcase/fixture from this procedure, rename it to *.nt.json (nt as in "no tabularasa").

package main

import (
	"crypto/sha1"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

func main() {
	fixtures, err := filepath.Glob("*.json")
	if err != nil {
		panic(err)
	}

	allLines, err := getCoverage("all")
	if err != nil {
		panic(err)
	}

	masterSum := sha1.New()
	masterSum.Write([]byte(strings.Join(allLines, "\n")))
	masterHash := fmt.Sprintf("%x", masterSum.Sum(nil))

	for i, f := range fixtures {
		fmt.Printf("[%03d of %03d] %s: ", i+1, len(fixtures), f)
		if strings.HasSuffix(f, ".nt.json") {
			fmt.Println("exempt (make sure this test is worth it!)")
			continue
		}

		nf := fmt.Sprintf("%s_DNT", f)
		err := os.Rename(f, nf)
		if err != nil {
			panic(err)
		}

		lines, err := getCoverage(f)
		if err != nil {
			panic(err)
		}
		if len(lines) < len(allLines) {
			fmt.Println("unnecessary (lc)")
			continue
		}
		if len(lines) > len(allLines) {
			panic("Removing a test increased test coverage - that cannot be")
		}

		lineSum := sha1.New()
		lineSum.Write([]byte(strings.Join(lines, "\n")))
		lineHash := fmt.Sprintf("%x", lineSum.Sum(nil))
		if lineHash == masterHash {
			fmt.Println("unnecessary (hash)")
			continue
		}

		os.Rename(nf, f)
		fmt.Println("good")
	}
}

func getCoverage(name string) ([]string, error) {
	td, err := filepath.Abs("..")
	if err != nil {
		return nil, err
	}

	coverFN := fmt.Sprintf("%s.cover", name)
	cmd := exec.Command("go", "test", fmt.Sprintf("-coverprofile=testdata/%s", coverFN), ".")
	cmd.Dir = td
	_, err = cmd.CombinedOutput()
	if err != nil {
		return nil, err
	}

	fc, err := os.ReadFile(coverFN)
	lines := strings.Split(string(fc), "\n")
	sort.Strings(lines)
	os.WriteFile(coverFN, []byte(strings.Join(lines, "\n")), 0644)

	return lines, nil
}
