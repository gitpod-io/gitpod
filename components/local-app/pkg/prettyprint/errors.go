// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package prettyprint

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/gookit/color"
)

var (
	styleError               = color.New(color.FgRed, color.Bold)
	stylePossibleResolutions = color.New(color.FgGreen, color.Bold)
	styleApology             = color.New(color.FgYellow, color.Bold)
)

// PrintError prints an error to the given writer.
func PrintError(out io.Writer, command string, err error) {
	fmt.Fprintf(out, "%s%s\n\n", styleError.Sprint("Error: "), err.Error())

	var (
		resolutions []string
		apology     bool
	)
	for err != nil {
		if r, ok := err.(*ErrResolution); ok {
			resolutions = append(resolutions, r.Resolutions...)
		}
		if _, ok := err.(*ErrApology); ok {
			apology = true
		}

		err = errors.Unwrap(err)
	}
	if len(resolutions) > 0 {
		fmt.Fprint(out, stylePossibleResolutions.Sprint("Possible resolutions:\n"))
		for _, r := range resolutions {
			r = strings.ReplaceAll(r, "{gitpod}", command)
			fmt.Fprintf(out, "  - %s\n", r)
		}
		fmt.Fprintln(out)
	}
	if apology {
		fmt.Fprintf(out, "%sIt looks like the system decided to take a surprise coffee break. We're not saying it's a bug... but it's a bug. While we can't promise moonshots, our team is peeking under the hood.\n\n", styleApology.Sprint("Our apologies 🙇\n"))
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

func AddApology(err error) *ErrApology {
	return &ErrApology{err}
}

type ErrApology struct {
	Err error
}

func (e ErrApology) Error() string {
	return e.Err.Error()
}

func (e ErrApology) Unwrap() error {
	return e.Err
}
