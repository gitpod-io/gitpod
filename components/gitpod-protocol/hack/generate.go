//go:generate sh generate.sh

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"strings"
	"text/template"
)

// Method is a method on the Gitpod Server interface
type Method struct {
	Name   string `json:"name"`
	GoName string `json:"-"`

	Params []struct {
		Name string `json:"name"`
		Type string `json:"type"`

		GoName string `json:"-"`
		GoType string `json:"-"`
	}
	GoParams string

	Result        string `json:"result"`
	GoResultType  string `json:"-"`
	GoReturnType  string `json:"-"`
	Void          bool   `json:"-"`
	PointerReturn bool   `json:"-"`
}

const tpl = `package rpc

// GitpodServerInterface wraps the Gitpod server
type APIInterface interface {
	{{- range $m := . }}
	{{ .GoName }}({{ .GoParams }}) {{ .GoReturnType }}
	{{- end }}
}

// FunctionName is the name of an RPC function
type FunctionName string

const (
	{{- range $m := . }}
	// Function{{ .GoName }} is the name of the {{ .Name }} function
	Function{{ .GoName }} FunctionName = "{{ .Name }}"
	{{- end }}
)

// APIoverJSONRPC makes JSON RPC calls to the Gitpod server
type APIoverJSONRPC struct {
	C *jsonrpc2.Conn
}

{{- range $m := . }}
// {{ .GoName }} calls {{ .Name }} on the server
func (gp *APIoverJSONRPC) {{ .GoName }}({{ .GoParams }}) {{ .GoReturnType }} {
	var _params []interface{}
	{{ range $p := .Params }}
	_params = append(_params, {{ .GoName }})
	{{- end }}
	{{ if .Void }}
	err = gp.C.Call(ctx, "{{ $m.Name }}", _params, nil)
	if err != nil {
		return
	}
	{{ else }}
	var result {{ .GoResultType }}
	err = gp.C.Call(ctx, "{{ $m.Name }}", _params, &result)
	if err != nil {
		return
	}
	res = {{ if .PointerReturn }}&{{end}}result
	{{ end }}
	return
}
{{ end }}
`

func main() {
	var mths []Method
	err := json.NewDecoder(os.Stdin).Decode(&mths)
	if err != nil {
		log.Fatal(err)
	}

	out, err := os.OpenFile("gitpod-service.go", os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}
	defer out.Close()

	allUsedTSTypes := make(map[string]string)
	for i, m := range mths {
		mths[i].GoName = strings.ToUpper(m.Name[0:1]) + m.Name[1:]

		rt := typescriptTypeToGoType(m.Result)
		if rt == "void" {
			mths[i].GoReturnType = "(err error)"
			mths[i].Void = true
		} else {
			mths[i].GoResultType = strings.TrimPrefix(rt, "*")
			mths[i].GoReturnType = fmt.Sprintf("(res %s, err error)", rt)
			mths[i].PointerReturn = !strings.HasPrefix(rt, "[]") && rt != "string"
		}
		if strings.HasPrefix(rt, "[]") || strings.HasPrefix(rt, "*") {
			tt := strings.TrimSuffix(trimTypescriptAdornments(m.Result), "[]")
			gt := strings.TrimPrefix(rt, "[]")
			gt = strings.TrimPrefix(gt, "*")
			allUsedTSTypes[tt] = gt
		}

		var goParams []string
		goParams = append(goParams, "ctx context.Context")
		for j, p := range m.Params {
			gt := typescriptTypeToGoType(p.Type)
			mths[i].Params[j].GoName = p.Name
			mths[i].Params[j].GoType = gt
			goParams = append(goParams, fmt.Sprintf("%s %s", mths[i].Params[j].GoName, mths[i].Params[j].GoType))

			if strings.HasPrefix(gt, "[]") || strings.HasPrefix(gt, "*") {
				tt := strings.TrimSuffix(trimTypescriptAdornments(p.Type), "[]")
				gt = strings.TrimPrefix(gt, "[]")
				gt = strings.TrimPrefix(gt, "*")
				allUsedTSTypes[tt] = gt
			}
		}
		mths[i].GoParams = strings.Join(goParams, ", ")
	}

	tmpl, err := template.New("tpl").Parse(tpl)
	if err != nil {
		log.Fatal(err)
	}
	err = tmpl.Execute(out, mths)
	if err != nil {
		log.Fatal(err)
	}

	tmpfile, err := ioutil.TempFile("", "")
	if err != nil {
		log.Fatal(err)
	}
	tmpfile.Close()
	fmt.Println("tmp file: " + tmpfile.Name())
	// defer os.Remove(tmpfile.Name())
	for tst, gt := range allUsedTSTypes {
		if _, bt := baseTypeMap[tst]; bt {
			continue
		}

		fmt.Println("generating " + tst)

		cmd := exec.Command("yarn", "typescript-json-schema", "tsconfig.json", "-o", tmpfile.Name(), tst)
		cmd.Dir = ".."
		cmd.Stderr = os.Stderr
		err := cmd.Run()
		if err != nil {
			log.Fatal(err)
		}

		buf := bytes.NewBuffer(nil)
		cmd = exec.Command("schema-generate", tmpfile.Name())
		cmd.Stdout = buf
		cmd.Stderr = os.Stderr
		err = cmd.Run()
		if err != nil {
			log.Fatal(err)
		}

		lines := strings.Split(buf.String(), "\n")
		for _, l := range lines {
			var hasPrefix bool
			for _, p := range []string{
				"//",
				"package main",
				"type Root string",
				"import (",
				"    \"encoding",
				"    \"bytes",
				"    \"fmt",
				")",
			} {
				if strings.HasPrefix(l, p) {
					hasPrefix = true
					break
				}
			}
			if hasPrefix {
				continue
			}
			if strings.HasPrefix(l, "type Root struct {") {
				l = fmt.Sprintf("type %s struct {", gt)
			}

			fmt.Fprintln(out, l)
		}
	}
}

var baseTypeMap = map[string]string{
	"string":  "string",
	"boolean": "bool",
	"number":  "float32",
	"void":    "void",
}

func trimTypescriptAdornments(t string) string {
	res := t
	if strings.HasPrefix(res, "Promise<") {
		res = strings.TrimSuffix(strings.TrimPrefix(res, "Promise<"), ">")
	}
	if strings.HasPrefix(res, "Partial<") {
		res = strings.TrimSuffix(strings.TrimPrefix(res, "Partial<"), ">")
	}
	res = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(res), "| undefined"))
	return res
}

func typescriptTypeToGoType(ts string) (res string) {
	res = trimTypescriptAdornments(ts)

	nt, ok := baseTypeMap[res]
	if ok {
		res = nt
	} else {
		res = "*" + res
	}

	if strings.HasSuffix(res, "[]") {
		res = "[]" + strings.TrimSuffix(res, "[]")
	}

	res = strings.ReplaceAll(res, ".", "")

	return
}
