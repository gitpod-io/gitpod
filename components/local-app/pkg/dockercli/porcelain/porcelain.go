// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

//go:generate go run generator.go

// Package ctrctl wraps container CLIs.
package porcelain

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// Cli is the command prefix.
var Cli = []string{"docker"}

// Verbose mode prints the commands being run and streams their output to the terminal.
var Verbose bool

var shUnsafe = regexp.MustCompile(`[^\w@%+=:,./-]`)

type CliError struct {
	*os.ProcessState

	Stderr string
}

func (e *CliError) Error() string {
	return e.ProcessState.String()
}

func runCtrCmd(subcommand []string, args []string, opts interface{}, optpos int) (string, error) {
	var strout strings.Builder
	var strerr strings.Builder
	var cmd *exec.Cmd

	cmdargs := append(Cli, subcommand...)
	cmdargs = append(cmdargs, args...)
	if !reflect.ValueOf(opts).IsNil() {
		cmdargs = append(cmdargs, optsToArgs(opts)...)
	}

	// for i := 0; i < len(args); i++ {
	// 	if optpos > -1 && i == optpos {
	// 		optpos = -1
	// 		i--
	// 	} else if !reflect.ValueOf(args[i]).IsZero() {
	// 		cmdargs = append(cmdargs, args[i])
	// 	}
	// }

	if !reflect.ValueOf(opts).IsNil() {
		var ok bool
		cmd, ok = reflect.ValueOf(opts).Elem().FieldByName("Cmd").Interface().(*exec.Cmd)
		if !ok {
			panic("exec.Cmd failed type assertion")
		}
	}

	if cmd == nil {
		cmd = &exec.Cmd{}
	}
	cmd.Path = cmdargs[0]
	cmd.Args = cmdargs
	if filepath.Base(cmd.Path) == cmd.Path {
		lp, err := exec.LookPath(cmd.Path)
		if lp != "" {
			cmd.Path = lp
		}
		if err != nil {
			cmd.Err = err
		}
	}

	prepareStreams(cmd, &strout, &strerr)

	if Verbose {
		fmt.Fprintf(os.Stderr, "+ %s\n", shJoin(cmdargs))
	}

	err := cmd.Run()
	if ee, ok := err.(*exec.ExitError); ok {
		err = &CliError{
			ProcessState: ee.ProcessState,
			Stderr:       strings.TrimSpace(strerr.String()),
		}
	}

	return strings.TrimSpace(strout.String()), err
}

func optsToArgs(opts interface{}) []string {
	result := []string{}
	val := reflect.ValueOf(opts).Elem()
	typ := val.Type()

	for i := 0; i < typ.NumField(); i++ {
		value := val.Field(i)
		field := typ.Field(i)

		if field.Name == "Cmd" {
			continue
		}

		if field.Type.Kind() == reflect.Ptr {
			if value.IsNil() {
				continue
			}
			val = val.Elem()
		}

		if field.Type.Kind() == reflect.String && value.IsZero() {
			continue
		}
		if field.Type.Kind() == reflect.Bool && !value.Bool() {
			continue
		}

		switch field.Type.Kind() {
		case reflect.Int:
			result = append(result, fieldToFlag(field.Name))
			result = append(result, strconv.FormatInt(value.Int(), 10))
		case reflect.String:
			result = append(result, fieldToFlag(field.Name))
			result = append(result, value.String())
		case reflect.Slice:
			for i := 0; i < value.Len(); i++ {
				result = append(result, value.Index(i).String())
			}
		case reflect.Bool:
			if value.Bool() {
				result = append(result, fieldToFlag(field.Name))
			}
		default:
			panic(fmt.Sprintf("unsupported type %v in %s", field.Type, field.Name))
		}
	}

	return result
}

func fieldToFlag(s string) string {
	var result []rune
	for i, r := range s {
		if unicode.IsUpper(r) {
			if i > 0 {
				result = append(result, '-')
			}
		}
		result = append(result, unicode.ToLower(r))
	}
	if len(result) == 1 {
		return fmt.Sprintf("-%s", string(result))
	} else {
		return fmt.Sprintf("--%s", string(result))
	}
}

func shQuote(s string) string {
	if s == "" {
		return `''`
	}
	if !shUnsafe.MatchString(s) {
		return s
	}
	return `'` + strings.ReplaceAll(s, `'`, `\'`) + `'`
}

func shJoin(parts []string) string {
	quotedParts := make([]string, len(parts))
	for i, part := range parts {
		quotedParts[i] = shQuote(part)
	}
	return strings.Join(quotedParts, " ")
}

func prepareStreams(cmd *exec.Cmd, outdefault io.Writer, errdefault io.Writer) {
	if cmd.Stdout == nil {
		cmd.Stdout = outdefault
	}
	if Verbose && cmd.Stdout != os.Stdout {
		cmd.Stdout = io.MultiWriter(cmd.Stdout, os.Stdout)
	}
	if cmd.Stderr == nil {
		cmd.Stderr = errdefault
	}
	if Verbose && cmd.Stderr != os.Stderr {
		cmd.Stderr = io.MultiWriter(cmd.Stderr, os.Stderr)
	}
}
