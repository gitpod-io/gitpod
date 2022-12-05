// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package yq

import (
	"bytes"
	"os"
	"strings"

	"github.com/mikefarah/yq/v4/pkg/yqlib"
	logging "gopkg.in/op/go-logging.v1"
	"k8s.io/utils/pointer"
)

func Process(input string, expression string) (*string, error) {
	// Stop the logging to Stderr
	var format = logging.MustStringFormatter(
		`%{color}%{time:15:04:05} %{shortfunc} [%{level:.4s}]%{color:reset} %{message}`,
	)
	var backend = logging.AddModuleLevel(
		logging.NewBackendFormatter(logging.NewLogBackend(os.Stderr, "", 0), format))

	backend.SetLevel(logging.ERROR, "")
	logging.SetBackend(backend)
	// End of logger config

	yqlib.InitExpressionParser()

	var writer bytes.Buffer
	printerWriter := yqlib.NewSinglePrinterWriter(&writer)
	encoder := yqlib.NewYamlEncoder(2, false, false, true)

	printer := yqlib.NewPrinter(encoder, printerWriter)

	decoder := yqlib.NewYamlDecoder()

	streamEvaluator := yqlib.NewStreamEvaluator()

	reader := strings.NewReader(input)

	node, err := yqlib.ExpressionParser.ParseExpression(expression)
	if err != nil {
		return nil, err
	}

	_, err = streamEvaluator.Evaluate("gitpod-installer.tmp.yaml", reader, node, printer, "", decoder)
	if err != nil {
		return nil, err
	}

	return pointer.String(writer.String()), nil
}
