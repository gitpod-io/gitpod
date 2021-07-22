// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package logif

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/PaesslerAG/gval"
	"github.com/buger/jsonparser"
	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/modules/logging"
	jsonselect "github.com/gitpod-io/gitpod/proxy/plugins/jsonselect"
	"github.com/gitpod-io/gitpod/proxy/plugins/logif/lang"
	"go.uber.org/zap"
	"go.uber.org/zap/buffer"
	"go.uber.org/zap/zapcore"
	"golang.org/x/term"
)

const (
	moduleName = "if"
	moduleID   = "caddy.logging.encoders." + moduleName
)

func init() {
	caddy.RegisterModule(ConditionalEncoder{})
}

type ConditionalEncoder struct {
	zapcore.Encoder       `json:"-"`
	zapcore.EncoderConfig `json:"-"`

	EncRaw    json.RawMessage `json:"encoder,omitempty" caddy:"namespace=caddy.logging.encoders inline_key=format"`
	Eval      gval.Evaluable  `json:"-"`
	Expr      string
	Logger    func(caddy.Module) *zap.Logger `json:"-"`
	Formatter string
}

func (ce ConditionalEncoder) Clone() zapcore.Encoder {
	ret := ConditionalEncoder{
		Encoder:       ce.Encoder.Clone(),
		EncoderConfig: ce.EncoderConfig,
		Eval:          ce.Eval,
		Logger:        ce.Logger,
		Formatter:     ce.Formatter,
	}
	return ret
}

func (ce ConditionalEncoder) EncodeEntry(e zapcore.Entry, fields []zapcore.Field) (*buffer.Buffer, error) {
	// Clone the original encoder to be sure we don't mess up it
	enc := ce.Encoder.Clone()

	if ce.Formatter == "console" {
		// Add the zap entries to the console encoder
		// todo > Set the values according to line_ending, time_format, level_format
		// todo > Investigate duration_format too?
		enc.AddString(ce.LevelKey, e.Level.String())
		enc.AddTime(ce.TimeKey, e.Time)
		enc.AddString(ce.NameKey, e.LoggerName)
		enc.AddString(ce.MessageKey, e.Message)
		// todo > caller, stack
	} else if ce.Formatter == "jsonselect" {
		// Use the JSON encoder that JSONSelect wraps
		jsonEncoder, ok := ce.Encoder.(jsonselect.JSONSelectEncoder)
		if !ok {
			return nil, fmt.Errorf("unexpected encoder type %T", ce.Encoder)
		}
		enc = jsonEncoder.Encoder
	}

	// Store the logging encoder's buffer
	buf, err := enc.EncodeEntry(e, fields)
	if err != nil {
		return buf, err
	}
	data := buf.Bytes()

	// Strip non JSON-like prefix from the data buffer when it comes from a non JSON encoder
	if pos := bytes.Index(data, []byte(`{"`)); ce.Formatter == "console" && pos != -1 {
		data = data[pos:]
	}

	// Extract values
	values := make(map[string]interface{})
	for _, key := range lang.Fields {
		path := strings.Split(key, ">")
		val, typ, _, err := jsonparser.Get(data, path...)
		if err != nil {
			// Field not found, ignore the current expression
			ce.Logger(&ce).Warn("field not found: please fix or remove it", zap.String("field", key))
			continue
		}
		switch typ {
		case jsonparser.NotExist:
			// todo > try to reproduce
		case jsonparser.Number, jsonparser.String, jsonparser.Boolean:
			values[key] = string(val)
		default:
			// Advice to remove it from the expression
			ce.Logger(&ce).Warn("field has an unsupported value type: please fix or remove it", zap.String("field", key), zap.String("type", typ.String()))
		}
	}

	// Evaluate the expression against values
	res, err := lang.Execute(ce.Eval, values)
	emit, ok := res.(bool)
	if !ok {
		ce.Logger(&ce).Error("expecting a boolean expression", zap.String("return", fmt.Sprintf("%T", res)))
		goto emitNothing
	}

	if emit {
		// Using the original (wrapped) encoder for output
		return ce.Encoder.EncodeEntry(e, fields)
	}

emitNothing:
	buf.Reset()
	return buf, nil
}

func (ConditionalEncoder) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID: moduleID, // see https://github.com/caddyserver/caddy/blob/ef7f15f3a42474319e2db0dff6720d91c153f0bf/caddyconfig/httpcaddyfile/builtins.go#L720
		New: func() caddy.Module {
			return new(ConditionalEncoder)
		},
	}
}

func (ce *ConditionalEncoder) Provision(ctx caddy.Context) error {
	// Store the logger
	ce.Logger = ctx.Logger

	if len(ce.Expr) == 0 {
		ctx.Logger(ce).Error("must provide an expression")
		return nil
	}

	if ce.EncRaw == nil {
		ce.Encoder, ce.Formatter = newDefaultProductionLogEncoder(true)

		ctx.Logger(ce).Warn("fallback to a default production logging encoder")
		return nil
	}

	val, err := ctx.LoadModule(ce, "EncRaw")
	if err != nil {
		return fmt.Errorf("loading fallback encoder module: %v", err)
	}
	switch v := val.(type) {
	case *logging.JSONEncoder:
		ce.EncoderConfig = v.LogEncoderConfig.ZapcoreEncoderConfig()
	case *logging.ConsoleEncoder:
		ce.EncoderConfig = v.LogEncoderConfig.ZapcoreEncoderConfig()
	case *jsonselect.JSONSelectEncoder:
		ce.EncoderConfig = v.LogEncoderConfig.ZapcoreEncoderConfig()
	default:
		return fmt.Errorf("unsupported encoder type %T", v)
	}
	ce.Encoder = val.(zapcore.Encoder)

	eval, err := lang.Compile(ce.Expr)
	if err != nil {
		return fmt.Errorf(err.Error())
	}
	ce.Eval = eval

	return nil
}

func newDefaultProductionLogEncoder(colorize bool) (zapcore.Encoder, string) {
	encCfg := zap.NewProductionEncoderConfig()
	if term.IsTerminal(int(os.Stdout.Fd())) {
		// if interactive terminal, make output more human-readable by default
		encCfg.EncodeTime = func(ts time.Time, encoder zapcore.PrimitiveArrayEncoder) {
			encoder.AppendString(ts.UTC().Format("2006/01/02 15:04:05.000"))
		}
		if colorize {
			encCfg.EncodeLevel = zapcore.CapitalColorLevelEncoder
		}
		return zapcore.NewConsoleEncoder(encCfg), "console"
	}
	return zapcore.NewJSONEncoder(encCfg), "json"
}

// Interface guards
var (
	_ zapcore.Encoder       = (*ConditionalEncoder)(nil)
	_ caddy.Provisioner     = (*ConditionalEncoder)(nil)
	_ caddyfile.Unmarshaler = (*ConditionalEncoder)(nil)
)
