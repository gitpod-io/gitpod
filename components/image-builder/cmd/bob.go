// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"fmt"
	"sort"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// bobCmd represents the bob command
var bobCmd = &cobra.Command{
	Use:   "bob",
	Short: "Bob the builder are a set of utility functions executed during an image build.",
	Long:  "You should rarely have to execute those commands yourself.",
	Args:  cobra.ExactArgs(1),
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Log.Logger.Formatter = &bobsFormatter{}
	},
}

func init() {
	rootCmd.AddCommand(bobCmd)
}

type bobsFormatter struct{}

const (
	white  = 15
	red    = 31
	yellow = 33
	blue   = 36
	//nolint:deadcode,unused,varcheck
	gray = 37
)

func (f *bobsFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	delete(entry.Data, "serviceContext")
	delete(entry.Data, "stage")

	var levelColor int
	switch entry.Level {
	case logrus.DebugLevel, logrus.TraceLevel:
		levelColor = blue
	case logrus.InfoLevel:
		levelColor = white
	case logrus.WarnLevel:
		levelColor = yellow
	case logrus.ErrorLevel, logrus.FatalLevel, logrus.PanicLevel:
		levelColor = red
	default:
		levelColor = blue
	}

	var b *bytes.Buffer
	if entry.Buffer != nil {
		b = entry.Buffer
	} else {
		b = &bytes.Buffer{}
	}

	keys := make([]string, 0, len(entry.Data))
	for k := range entry.Data {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	fmt.Fprintf(b, "\x1b[%dm%-44s ", levelColor, entry.Message)
	for _, k := range keys {
		value := entry.Data[k]
		fmt.Fprintf(b, " \x1b[%dm%s\x1b[0m=", levelColor, k)

		b.WriteString(fmt.Sprintf("%v", value))
	}

	b.WriteByte('\n')
	return b.Bytes(), nil
}
