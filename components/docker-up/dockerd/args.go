// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dockerd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

const (
	gitpodUserId = 33333
)

type ConvertUserArg func(arg string, value interface{}) ([]string, error)

var allowedDockerArgs = map[string]ConvertUserArg{
	"remap-user": convertRemapUser,
	// TODO(gpl): Why this allow-list instead of a converter lookup only?
	"proxies":     nil,
	"http-proxy":  nil,
	"https-proxy": nil,
}

func ParseUserArgs(log *logrus.Entry, userArgs string) ([]string, error) {
	if userArgs == "" {
		return nil, nil
	}

	var providedDockerArgs map[string]interface{}
	if err := json.Unmarshal([]byte(userArgs), &providedDockerArgs); err != nil {
		return nil, xerrors.Errorf("unable to deserialize docker args: %w", err)
	}

	return mapUserArgs(log, providedDockerArgs)
}

func mapUserArgs(log *logrus.Entry, jsonObj map[string]interface{}) ([]string, error) {
	args := []string{}
	for userArg, userValue := range jsonObj {
		converter, exists := allowedDockerArgs[userArg]
		if !exists {
			// TODO(gpl): Why this allow-list instead of a converter lookup only?
			continue
		}

		if converter != nil {
			cargs, err := converter(userArg, userValue)
			if err != nil {
				return nil, xerrors.Errorf("could not convert %v - %v: %w", userArg, userValue, err)
			}
			args = append(args, cargs...)
			continue
		}

		strValue, ok := (userValue).(string)
		if ok {
			args = append(args, fmt.Sprintf("--%s=%s", userArg, strValue))
			continue
		}

		bValue, ok := (userValue).(bool)
		if ok {
			args = append(args, fmt.Sprintf("--%s=%t", userArg, bValue))
			continue
		}

		obj, ok := (userValue).(map[string]interface{})
		if ok {
			nestedArgs, err := mapUserArgs(log, obj)
			if err != nil {
				return nil, xerrors.Errorf("could not convert nested arg %v - %v: %w", userArg, userValue, err)
			}
			args = append(args, nestedArgs...)
			continue
		}

		log.WithField("arg", userArg).WithField("value", userValue).Warn("could not map userArg to dockerd argument, skipping.")
	}

	return args, nil
}

func convertRemapUser(arg string, value interface{}) ([]string, error) {
	v, ok := (value).(string)
	if !ok {
		return nil, xerrors.Errorf("userns-remap expects a string argument")
	}

	id, err := strconv.Atoi(v)
	if err != nil {
		return nil, err
	}

	for _, f := range []string{"/etc/subuid", "/etc/subgid"} {
		err := adaptSubid(f, id)
		if err != nil {
			return nil, xerrors.Errorf("could not adapt subid files: %w", err)
		}
	}

	return []string{"--userns-remap", "gitpod"}, nil
}

func adaptSubid(oldfile string, id int) error {
	uid, err := os.Open(oldfile)
	if err != nil {
		return err
	}

	newfile, err := os.Create(oldfile + ".new")
	if err != nil {
		return err
	}

	mappingFmt := func(username string, id int, size int) string { return fmt.Sprintf("%s:%d:%d\n", username, id, size) }

	if id != 0 {
		newfile.WriteString(mappingFmt("gitpod", 1, id))
		newfile.WriteString(mappingFmt("gitpod", gitpodUserId, 1))
	} else {
		newfile.WriteString(mappingFmt("gitpod", gitpodUserId, 1))
		newfile.WriteString(mappingFmt("gitpod", 1, gitpodUserId-1))
		newfile.WriteString(mappingFmt("gitpod", gitpodUserId+1, 32200)) // map rest of user ids in the user namespace
	}

	uidScanner := bufio.NewScanner(uid)
	for uidScanner.Scan() {
		l := uidScanner.Text()
		if !strings.HasPrefix(l, "gitpod") {
			newfile.WriteString(l + "\n")
		}
	}

	if err = os.Rename(newfile.Name(), oldfile); err != nil {
		return err
	}

	return nil
}
