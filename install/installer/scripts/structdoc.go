// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"flag"
	"fmt"
	"go/ast"
	"go/doc"
	"go/parser"
	"go/token"
	"io/ioutil"
	"path/filepath"
	"strings"

	"github.com/fatih/structtag"
	log "github.com/sirupsen/logrus"
)

const (
	configDir = "./pkg/config" // todo(nvn): better ways to handle the config path
)

var version string

type configDoc struct {
	configName string
	doc        string
	fields     map[string][]fieldSpec
}

type fieldSpec struct {
	name          string
	required      bool
	doc           string
	value         string
	allowedValues string
}

// extractTags strips the tags of each struct field and returns json name of the
// field and if the field is a mandatory one
func extractTags(tag string) (result fieldSpec, err error) {

	// unfortunately structtag doesn't support multiple keys,
	// so we have to handle this manually
	tag = strings.Trim(tag, "`")

	tagObj, err := structtag.Parse(tag) // we assume at least JSON tag is always present
	if err != nil {
		return
	}

	metadata, err := tagObj.Get("json")
	if err != nil {
		// There is no "json" tag in this key - move on
		err = nil
		return
	}

	result.name = metadata.Name

	reqInfo, err := tagObj.Get("validate")
	if err != nil {
		// bit of a hack to overwrite the value of error since we do
		// not care if `validate` field is absent
		err = nil
		result.required = false
	} else {
		result.required = reqInfo.Name == "required"
	}

	return
}

func extractPkg(name string, dir string) (config configDoc, err error) {
	fset := token.NewFileSet()

	pkgs, err := parser.ParseDir(fset, dir, nil, parser.ParseComments)
	if err != nil {
		return
	}

	pkgInfo, ok := pkgs[name]

	if !ok {
		err = fmt.Errorf("Could not extract pkg %s", name)
		return
	}

	pkgData := doc.New(pkgInfo, "./", 0)

	return extractStructInfo(pkgData.Types)
}

func extractStructFields(structType *ast.StructType) (specs []fieldSpec, err error) {
	var fieldInfo fieldSpec
	if structType != nil && structType.Fields != nil {

		for _, field := range structType.Fields.List {
			// we extract all the tags of the struct
			if field.Tag != nil {
				fieldInfo, err = extractTags(field.Tag.Value)
				if err != nil {
					return
				}

				// we document experimental section separately
				if fieldInfo.name == "experimental" {
					continue
				}
			}

			switch xv := field.Type.(type) {
			case *ast.StarExpr:
				if si, ok := xv.X.(*ast.Ident); ok {
					fieldInfo.value = si.Name
				}
			case *ast.Ident:
				fieldInfo.value = xv.Name
			case *ast.ArrayType:
				fieldInfo.value = fmt.Sprintf("[]%s", xv.Elt)
			}

			// Doc about the field can be provided as a comment
			// above the field
			if field.Doc != nil {
				var comment string = ""

				// sometimes the comments are multi-line
				for _, line := range field.Doc.List {
					comment = fmt.Sprintf("%s %s", comment, strings.Trim(line.Text, "//"))
				}

				fieldInfo.doc = comment
			}

			specs = append(specs, fieldInfo)
		}
	}

	return
}

func extractStructInfo(structTypes []*doc.Type) (configSpec configDoc, err error) {
	configSpec.fields = map[string][]fieldSpec{}
	for _, t := range structTypes {

		typeSpec := t.Decl.Specs[0].(*ast.TypeSpec)

		structType, ok := typeSpec.Type.(*ast.StructType)
		if !ok {
			typename, aok := typeSpec.Type.(*ast.Ident)
			if !aok {
				continue
			}

			allowed := []string{}
			for _, con := range t.Consts[0].Decl.Specs {
				value, ok := con.(*ast.ValueSpec)
				if !ok {
					continue
				}

				for _, val := range value.Values {
					bslit := val.(*ast.BasicLit)

					allowed = append(allowed, fmt.Sprintf("`%s`", strings.Trim(bslit.Value, "\"")))
				}
			}

			configSpec.fields[typeSpec.Name.Name] = []fieldSpec{
				{
					name:          typeSpec.Name.Name,
					allowedValues: strings.Join(allowed, ", "),
					value:         typename.Name,
					doc:           t.Consts[0].Doc,
				},
			}

			continue

		}

		structSpecs, err := extractStructFields(structType)
		if err != nil {
			return configSpec, err
		}

		if t.Name == "Config" {
			if strings.Contains(t.Doc, "experimental") {
				// if we are dealing with experimental pkg we rename the config title
				configSpec.configName = "Experimental config parameters"
				configSpec.doc = "Additional config parameters that are in experimental state"
			} else {
				configSpec.configName = t.Name
				configSpec.doc = t.Doc
				// we hardcode the value for apiVersion since it is not present in
				// Config struct
				structSpecs = append(structSpecs,
					fieldSpec{
						name:     "apiVersion",
						required: true,
						value:    "string",
						doc: fmt.Sprintf("API version of the Gitpod config defintion."+
							" `%s` in this version of Config", version)})
			}
		}

		configSpec.fields[typeSpec.Name.Name] = structSpecs
	}

	return
}

// parseConfigDir parses the AST of the config package and returns metadata
// about the `Config` struct
func parseConfigDir(fileDir string) (configSpec []configDoc, err error) {
	// we basically parse the AST of the config package
	configStruct, err := extractPkg("config", fileDir)
	if err != nil {
		return
	}

	experimentalDir := fmt.Sprintf("%s/%s", fileDir, "experimental")
	// we parse the AST of the experimental package since we have additional
	// Config there
	experimentalStruct, err := extractPkg("experimental", experimentalDir)
	if err != nil {
		return
	}

	configSpec = []configDoc{configStruct, experimentalStruct}

	return
}

func recurse(configSpec configDoc, field fieldSpec, parent string) []fieldSpec {
	// check if field has type array
	var arrayString, valuename string
	if strings.Contains(field.value, "[]") {
		arrayString = "[ ]"
		valuename = strings.Trim(field.value, "[]")
	} else {
		valuename = field.value
	}

	field.name = fmt.Sprintf("%s%s%s", parent, field.name, arrayString)
	// results := []fieldSpec{field}
	results := []fieldSpec{}
	subFields := configSpec.fields[valuename]

	if len(subFields) < 1 {
		// this means that this is a leaf node, terminating condition
		return []fieldSpec{field}
	}

	for _, sub := range subFields {
		results = append(results, recurse(configSpec, sub, field.name+".")...)
	}

	return results
}

func generateMarkdown(configSpec configDoc, mddoc *strings.Builder) {

	var prefix string = ""
	if strings.Contains(configSpec.configName, "Experimental") {
		prefix = "experimental."
	}

	mddoc.WriteString(fmt.Sprintf("# %s %s\n\n%s\n", configSpec.configName, version, configSpec.doc))
	mddoc.WriteString("\n## Supported parameters\n")
	mddoc.WriteString("| Property | Type | Required | Allowed| Description |\n")
	mddoc.WriteString("| --- | --- | --- | --- | --- |\n")

	results := []fieldSpec{}
	fieldLists := configSpec.fields["Config"]
	for _, field := range fieldLists {
		results = append(results, recurse(configSpec, field, "")...)
	}

	for _, res := range results {
		reqd := "N"
		if res.required {
			reqd = "Y"
		}

		if res.allowedValues != "" {
			lastInd := strings.LastIndex(res.name, ".")
			res.name = res.name[:lastInd]

		}

		mddoc.WriteString(fmt.Sprintf("|`%s%s`|%s|%s| %s |%s|\n", prefix,
			res.name, res.value, reqd, res.allowedValues, strings.TrimSuffix(res.doc,
				"\n")))
	}

	mddoc.WriteString("\n\n")
}

func main() {
	versionFlag := flag.String("version", "v1", "Config version for doc creation")
	flag.Parse()

	version = *versionFlag

	log.Infof("Generating doc for config version %s", version)

	fileDir := fmt.Sprintf("%s/%s", configDir, version)

	// get the `Config` struct field info from `config` pkg
	configSpec, err := parseConfigDir(fileDir)
	if err != nil {
		log.Fatal(err)
	}

	// generate markdown for the doc

	mddoc := &strings.Builder{}
	for _, spec := range configSpec {
		generateMarkdown(spec, mddoc)
	}

	// write the md file of name config.md in the same directory as config
	mdfilename := filepath.Join(fileDir, "config.md")

	err = ioutil.WriteFile(mdfilename, []byte(mddoc.String()), 0644)
	if err != nil {
		log.Fatal(err)
	}

	log.Infof("The doc is written to the file %s", mdfilename)
}
