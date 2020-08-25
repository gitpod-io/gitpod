// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package sources

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gitpod-io/installer/pkg/ui"
	"github.com/manifoldco/promptui"
)

// Layout describes the source layout
type Layout struct {
	Helm        string            `yaml:"helm"`
	Terraform   map[string]string `yaml:"terraform"`
	Destination string            `yaml:"destination"`
	VersionFile string            `yaml:"versionFile"`
}

// DifferentVersionResolution determines how to continue if the install-script versions differ
type DifferentVersionResolution int

const (
	// DifferentVersionsCancel cancels the operation
	DifferentVersionsCancel DifferentVersionResolution = iota
	// DifferentVersionBackupAndContinue backs up the old files and copies the new ones
	DifferentVersionBackupAndContinue
	// DifferentVerionsIgnoreAndContinue ignores the new version and continues
	DifferentVerionsIgnoreAndContinue
)

// CloneAndOwnOpts provides options for the clone & own process
type CloneAndOwnOpts struct {
	AskIfVersionDiffers func(existingVersion, newVersion string) DifferentVersionResolution

	// If set this overrides the content of VersionFile
	SourceVersion string
}

// DefaultAskIfVersionDiffers is the default behaviour when there's an existing version
// of the terraform scripts already.
func DefaultAskIfVersionDiffers(existingVersion, newVersion string) DifferentVersionResolution {
	fmt.Printf(`The version of the installer scripts has changed.
	old version: %s
	new version: %s
	
`, existingVersion, newVersion)

	choices := []struct {
		Name  string
		Value DifferentVersionResolution
	}{
		{"Backup existing files and continue with new version (recommended)", DifferentVersionBackupAndContinue},
		{"Ignore new version and continue with old one", DifferentVerionsIgnoreAndContinue},
		{"Cancel", DifferentVersionsCancel},
	}
	i, _, err := (&promptui.Select{
		Label: "How would you like to continue?",
		Items: choices,
		Templates: &promptui.SelectTemplates{
			Active:   fmt.Sprintf("%s {{ .Name | underline }}", promptui.IconSelect),
			Inactive: "{{ .Name }}",
			Selected: "",
		},
	}).Run()

	if err != nil {
		ui.Fatalf("unsupported choice: %q", err)
	}

	return choices[i].Value
}

// ErrCanceled is returned when AskIfVersionDiffers returns false
var ErrCanceled = fmt.Errorf("versions differed and was asked to cancel")

// CloneAndOwn copies the terraform sources and helm chart to the destination if
//   - the destination does not exist
//   - there is no version file at the destination
//   - the version file at the destination differs from the source one.
//
// In case of the latter, this function will ask if existing files should be backed up,
// or if the process is to be canceled.
func CloneAndOwn(l Layout, opts CloneAndOwnOpts) (err error) {
	if opts.AskIfVersionDiffers == nil {
		opts.AskIfVersionDiffers = DefaultAskIfVersionDiffers
	}

	srcver := []byte(opts.SourceVersion)
	if len(srcver) == 0 {
		srcver, err = ioutil.ReadFile(l.VersionFile)
		if err != nil {
			return fmt.Errorf("cannot read source version file %s: %w", l.VersionFile, err)
		}
	}

	var (
		dstVersionExists bool
		dstVersionFn     = l.VersionDestination()
		dstFolder        = l.DestinationFolder()
		dstbkp           = l.BackupDestination()
	)
	if _, err := os.Stat(dstVersionFn); err == nil {
		dstVersionExists = true
	} else if os.IsNotExist(err) {
		dstVersionExists = false
	} else {
		return err
	}

	if dstVersionExists {
		dstver, err := ioutil.ReadFile(dstVersionFn)
		if err != nil {
			return fmt.Errorf("cannot read destination version file %s: %w", dstVersionFn, err)
		}
		if bytes.EqualFold(dstver, srcver) {
			// versions match - content is already up to date
			return nil
		}
		switch opts.AskIfVersionDiffers(strings.TrimSpace(string(dstver)), strings.TrimSpace(string(srcver))) {
		case DifferentVerionsIgnoreAndContinue:
			// sources exist - we're done
			return nil
		case DifferentVersionBackupAndContinue:
			// backup the old content
			_ = os.MkdirAll(filepath.Dir(dstbkp), 0755)
			err = os.Rename(dstFolder, dstbkp)
			if err != nil {
				return fmt.Errorf("cannot backup %s to %s: %w", dstFolder, dstbkp, err)
			}
		case DifferentVersionsCancel:
			return ErrCanceled
		}
	}

	if _, err = os.Stat(dstFolder); os.IsNotExist(err) {
		err = os.MkdirAll(dstFolder, 0755)
	}
	if err != nil {
		return err
	}

	out, err := exec.Command("cp", "-rf", l.Helm, l.HelmDestination()).CombinedOutput()
	if err != nil {
		return fmt.Errorf("cannot copy %s to %s: %s", l.Helm, l.HelmDestination(), string(out))
	}
	for plt, src := range l.Terraform {
		out, err := exec.Command("cp", "-rf", src, l.TerraformDestination(plt)).CombinedOutput()
		if err != nil {
			return fmt.Errorf("cannot copy %s to %s: %s", src, l.TerraformDestination(plt), string(out))
		}

		// there are some files from the backup we might want to keep
		for _, keeper := range []string{"main.auto.tfvars", "terraform.tfstate", "terraform.tfstate.backup"} {
			bkpfn := filepath.Join(dstbkp, plt, keeper)
			if _, err := os.Stat(bkpfn); err != nil {
				continue
			}

			dst := filepath.Join(l.TerraformDestination(plt), keeper)
			out, err := exec.Command("cp", "-rf", bkpfn, dst).CombinedOutput()
			if err != nil {
				ui.Warnf("cannot copy old %s file: %s", keeper, string(out))
			}
		}
	}

	err = ioutil.WriteFile(dstVersionFn, []byte(srcver), 0644)
	if err != nil {
		return fmt.Errorf("cannot write destination version file %s: %w", dstVersionFn, err)
	}

	return nil
}

// DestinationFolder is the folder where the actual contents (helm and terraform) are copied to
func (l Layout) DestinationFolder() string {
	return filepath.Join(l.Destination, "gitpod")
}

// HelmDestination returns the path to where the helm contents were copied to
func (l Layout) HelmDestination() string {
	return filepath.Join(l.DestinationFolder(), "helm")
}

// TerraformDestination is the path where the terraform contents were copied to
func (l Layout) TerraformDestination(platform string) string {
	return filepath.Join(l.DestinationFolder(), platform)
}

// BackupDestination is the destination where a new backup should be made to
func (l Layout) BackupDestination() string {
	return filepath.Join(l.Destination, "backup", fmt.Sprint(time.Now().Unix()))
}

// VersionDestination is the location where the dest version file resides
func (l Layout) VersionDestination() string {
	return filepath.Join(l.Destination, "version")
}
