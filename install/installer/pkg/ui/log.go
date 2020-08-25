// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ui

import (
	"fmt"
	"os"
	"strings"

	"github.com/gookit/color"
)

// Command prints a command as run by the installer
func Command(name string, args ...string) {
	fmt.Println(prefix(color.Gray.Light().Sprintf("running command: %s %v", name, args), "  ", color.BgGray.Light()))
}

// Infof logs out something informative
func Infof(format string, args ...interface{}) {
	fmt.Println(prefix(fmt.Sprintf(format, args...), "  ", color.BgGreen))
}

// Warnf warns the user about something
func Warnf(format string, args ...interface{}) {
	fmt.Println(prefix(fmt.Sprintf(format, args...), "  ", color.BgYellow))
}

// Errorf prints an error message
func Errorf(format string, args ...interface{}) {
	fmt.Println(prefix(fmt.Sprintf("\n"+format+"\n", args...), "  ", color.BgRed.Light()))
}

// Fatalf prints the message and exits with exit code 1
func Fatalf(format string, args ...interface{}) {
	fmt.Println(prefix(fmt.Sprintf("\n"+format+"\n", args...), "!!", color.BgRed.Light()))
	os.Exit(1)
}

func prefix(txt, prefix string, c color.Color) string {
	lines := strings.Split(txt, "\n")
	for i, l := range lines {
		lines[i] = c.Sprint(prefix) + " " + l
	}
	return strings.Join(lines, "\n")
}
