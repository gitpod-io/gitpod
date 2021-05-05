// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"strings"

	"github.com/coreos/go-systemd/v22/dbus"
	"github.com/gitpod-io/gitpod/common-go/log"
)

func main() {
	verbose := true
	log.Init("kubelet-config-fix", "", true, verbose)

	ctx := context.Background()

	configFileName := "/etc/default/kubelet"
	if len(os.Args) > 1 {
		configFileName = os.Args[1]
	}

	unitName := "kubelet.service"
	if len(os.Args) > 2 {
		unitName = os.Args[2]
	}

	changed, err := alterKubeletConfig(configFileName)
	if err != nil {
		log.WithField("config file", configFileName).Fatal(err)
	}

	if changed {
		err = restartKubelet(ctx, unitName)
		if err != nil {
			log.WithField("unit", unitName).Fatal(err)
		}
	}

	log.Debug("Done")
}

func alterKubeletConfig(configFileName string) (bool, error) {
	log.WithField("config file", configFileName).Debug("Altering kubelet config ...")
	config, err := ioutil.ReadFile(configFileName)
	if err != nil {
		return false, err
	}

	flag := "--serialize-image-pulls=false"
	str := string(config)
	log.WithField("config file", configFileName).WithField("content", str).Debug("kubelet config before")

	if strings.Contains(str, flag) {
		log.WithField("config file", configFileName).Infof("kubelet config has already flag %s", flag)
		return false, nil
	}
	lines := strings.Split(str, "\n")
	lines[0] = fmt.Sprintf("%s %s\"", strings.TrimRight(lines[0], "\""), flag)
	str = strings.Join(lines, "\n")
	log.WithField("config file", configFileName).WithField("content", str).Debug("kubelet config after")

	config = []byte(str)

	info, err := os.Stat(configFileName)
	if err != nil {
		return false, err
	}

	err = ioutil.WriteFile(configFileName, config, info.Mode())
	if err != nil {
		return false, err
	}

	log.WithField("config file", configFileName).Debug("kubelet config changed")

	return true, nil
}

func restartKubelet(ctx context.Context, unitName string) error {
	log.WithField("unit", unitName).Debug("Restarting kubelet ...")
	conn, err := dbus.NewWithContext(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	ch := make(chan string)
	code, err := conn.RestartUnitContext(ctx, unitName, "replace", ch)
	if err != nil {
		return err
	}
	log.WithField("unit", unitName).WithField("code", code).Info("result code")
	res := <-ch
	log.WithField("unit", unitName).WithField("res", res).Info("result string")
	return nil
}
