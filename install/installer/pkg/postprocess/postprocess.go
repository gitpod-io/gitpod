// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package postprocess

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	openvsxproxy "github.com/gitpod-io/gitpod/installer/pkg/components/openvsx-proxy"
	"github.com/mikefarah/yq/v4/pkg/yqlib"
	logging "gopkg.in/op/go-logging.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/pointer"
)

// Processors list of processes executed on each resource document
var Processors = []Processor{
	// Remove "status" from root of all network policies
	{
		Type:       common.TypeMetaNetworkPolicy,
		Expression: "del(.status)",
	},
	// Remove "status" from root of OpenVSXProxy stateful sets
	{
		Type:       common.TypeMetaStatefulSet,
		Expression: "del(.status)",
		Name:       pointer.String(openvsxproxy.Component),
	},
}

type Processor struct {
	Type       metav1.TypeMeta
	Expression string
	Name       *string // Optional
}

// process emulates how YQ parsers the file
func process(expression string, obj *common.RuntimeObject) error {
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

	reader := strings.NewReader(obj.Content)

	node, err := yqlib.ExpressionParser.ParseExpression(expression)
	if err != nil {
		return err
	}

	// This is used for debugging
	filename := fmt.Sprintf("%s %s %s", obj.APIVersion, obj.Kind, obj.Metadata.Name)

	_, err = streamEvaluator.Evaluate(filename, reader, node, printer, "", decoder)
	if err != nil {
		return err
	}

	// Overwrite the content with the parsed data
	obj.Content = writer.String()

	return nil
}

func useProcessor(object common.RuntimeObject, processor Processor) bool {
	if object.APIVersion == processor.Type.APIVersion && object.Kind == processor.Type.Kind {
		// Name is optional
		if processor.Name == nil {
			// Name not specified - return
			return true
		}

		// Name specified - match
		return object.Metadata.Name == *processor.Name
	}

	return false
}

func Run(objects []common.RuntimeObject) ([]common.RuntimeObject, error) {
	result := make([]common.RuntimeObject, 0)

	for _, o := range objects {
		for _, p := range Processors {
			if useProcessor(o, p) {
				err := process(p.Expression, &o)
				if err != nil {
					return nil, err
				}
			}
		}

		result = append(result, o)
	}

	return result, nil
}
