// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package prettyprint

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/fatih/color"
)

var (
	styleError               = color.New(color.FgRed, color.Bold)
	stylePossibleResolutions = color.New(color.FgGreen, color.Bold)
)

// PrintError prints an error to the given writer.
func PrintError(out io.Writer, err error, nocolor bool) {
	color.NoColor = nocolor
	fmt.Fprintf(out, "%s%s\n", styleError.Sprint("Error: "), err.Error())
}

// PrintResolutions prints all resolutions of an error to the given writer.
func PrintResolutions(out io.Writer, command string, err error, nocolor bool) {
	var resolutions []string
	for err != nil {
		if r, ok := err.(*ErrResolution); ok {
			resolutions = append(resolutions, r.Resolutions...)
		}

		err = errors.Unwrap(err)
	}

	color.NoColor = nocolor
	if len(resolutions) > 0 {
		fmt.Fprint(out, stylePossibleResolutions.Sprint("\nPossible resolutions:\n"))
		for _, r := range resolutions {
			r = strings.ReplaceAll(r, "{gitpod}", command)
			fmt.Fprintf(out, "  - %s\n", r)
		}
		fmt.Fprintln(out)
	}
}

// AddResolution adds a resolution to an error. Resolutions are hints that tell the user how to resolve the error.
func AddResolution(err error, resolution ...string) *ErrResolution {
	return &ErrResolution{
		Err:         err,
		Resolutions: resolution,
	}
}

type ErrResolution struct {
	Err         error
	Resolutions []string
}

func (e *ErrResolution) Error() string {
	return e.Err.Error()
}

func (e *ErrResolution) Unwrap() error {
	return e.Err
}
