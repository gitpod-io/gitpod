// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terraform

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"strings"

	"github.com/gitpod-io/installer/pkg/ui"
	"github.com/gookit/color"
	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclparse"
	"github.com/hashicorp/hcl/v2/hclwrite"
	"github.com/zclconf/go-cty/cty"
)

// PersistVariableOpts configures PersistVariable
type PersistVariableOpts struct {
	Name           string
	Spec           VariableSpec
	Sources        []VariableValueSource
	ForceOverwrite bool
}

// VariableSpec describes a variable
type VariableSpec struct {
	Description string
	Validate    func(val string) error
}

// VariableValueSource can possibly produce a value for the variable
type VariableValueSource func(name string, spec VariableSpec) (value string, ok bool)

// PersistVariable tries to obtain the variable value and set it in the terraform file.
// If the value is already set in the TF file, nothing will happen.
func PersistVariable(file string, opts ...PersistVariableOpts) error {
	tf, err := loadOrCreateFile(file)
	if err != nil {
		return err
	}

	for _, opt := range opts {
		if tf.Body().GetAttribute(opt.Name) != nil && !opt.ForceOverwrite {
			continue
		}

		var (
			val string
			ok  bool
		)
		srcs := append(opt.Sources,
			getVariableValueFromEnv,
			getVariableValueInteractively,
		)
		for _, src := range srcs {
			val, ok = src(opt.Name, opt.Spec)
			if ok {
				break
			}
		}
		if opt.Spec.Validate != nil {
			err = opt.Spec.Validate(val)
			if err != nil {
				return fmt.Errorf("invalid value for %q: %w", opt.Name, err)
			}
		}
		tf.Body().SetAttributeValue(opt.Name, cty.StringVal(val))
	}

	f, err := os.OpenFile(file, os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = tf.WriteTo(f)
	if err != nil {
		return err
	}

	return nil
}

// UnsetVariable unsets/removes a variable from a tf file
func UnsetVariable(file string, name string) error {
	tf, err := loadOrCreateFile(file)
	if err != nil {
		return err
	}

	tf.Body().RemoveAttribute(name)

	f, err := os.OpenFile(file, os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = tf.WriteTo(f)
	if err != nil {
		return err
	}

	return nil
}

func loadOrCreateFile(fn string) (*hclwrite.File, error) {
	fc, err := ioutil.ReadFile(fn)
	if os.IsNotExist(err) {
		ui.Infof("variables file does exist - creating new one: %s", fn)
		return hclwrite.NewEmptyFile(), nil
	}

	if err != nil {
		return nil, err
	}
	tf, diags := hclwrite.ParseConfig(fc, fn, hcl.Pos{Line: 1, Column: 1})
	if diags.HasErrors() {
		return nil, fmt.Errorf("terraform file %s has errors: %s", fn, diags)
	}
	return tf, nil
}

func getVariableValueFromEnv(name string, spec VariableSpec) (value string, ok bool) {
	return os.LookupEnv(fmt.Sprintf("INSTALLER_%s", strings.ToUpper(name)))
}

func getVariableValueInteractively(name string, spec VariableSpec) (value string, ok bool) {
	fmt.Printf("\n%s\n%s ? ", color.Bold.Sprint(spec.Description), name)

	for {
		in := bufio.NewScanner(os.Stdin)
		if !in.Scan() {
			return "", false
		}
		value = strings.TrimSpace(in.Text())

		if spec.Validate != nil {
			err := spec.Validate(value)
			if err != nil {
				ui.Warnf(err.Error())
				fmt.Printf("%s ? ", name)
				continue
			}
		}

		break
	}

	if value == "" {
		return "", false
	}
	return value, true
}

// GetVariableValue reads the value of a variable from a file
func GetVariableValue(fn, name string) (string, error) {
	f, _ := hclparse.NewParser().ParseHCLFile(fn)
	if f == nil {
		return "", fmt.Errorf("cannot parse %s", fn)
	}

	attrs, _ := f.Body.JustAttributes()
	attr := attrs[name]
	if attr == nil {
		return "", nil
	}
	val, _ := attr.Expr.Value(nil)
	return val.AsString(), nil
}

// GetOutputValue reads the value of an output variable from a terraform.tfstate file
func GetOutputValue(basedir string, variable string) (string, error) {
	args := []string{"show", "-json"}
	ui.Command("terraform", args...)
	tfcmd := exec.Command("terraform", args...)
	tfcmd.Dir = basedir
	out, err := tfcmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("cannot run terraform: %w", err)
	}

	var outputs struct {
		Values struct {
			Outputs map[string]struct {
				Value string `json:"value"`
			} `json:"outputs"`
		} `json:"values"`
	}
	err = json.Unmarshal(out, &outputs)
	if err != nil {
		return "", fmt.Errorf("cannot unmarshal terraform output")
	}

	val, ok := outputs.Values.Outputs[variable]
	if !ok {
		return "", nil
	}

	return val.Value, nil
}
