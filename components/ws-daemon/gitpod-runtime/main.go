package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"

	"github.com/opencontainers/runtime-spec/specs-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

var (
	fuseDeviceMajor  int64 = 10
	fuseDeviceMinor  int64 = 229
	FacadeConfigPath       = "/etc/gitpod/facade.json"
	Log              *logrus.Logger
)

func main() {
	cfg, err := getConfig()
	if err != nil {
		os.Exit(1)
	}

	setupLogging(cfg)

	runtimePath, err := exec.LookPath(cfg.Runtime)
	if err != nil {
		Log.WithError(err).Fatalf("%s not found", runtimePath)
	}

	if shouldUseFacade() {
		err = createAndRunc(runtimePath, cfg)
	} else {
		err = syscall.Exec(runtimePath, os.Args, os.Environ())
	}
	if err != nil {
		Log.WithError(err).Fatal("failed")
	}
}

func createAndRunc(runcPath string, cfg *facadeConfig) error {
	bundleDir, err := getBundleDir()
	if err != nil {
		return err
	}

	containerConfPath := filepath.Join(bundleDir, "config.json")
	confJson, err := os.ReadFile(containerConfPath)
	if err != nil {
		return xerrors.Errorf("cannot read config.json: %w", err)
	}

	var containerConf specs.Spec
	err = json.Unmarshal(confJson, &containerConf)
	if err != nil {
		return xerrors.Errorf("cannot decode config.json: %w", err)
	}

	fuseDeviceResource := specs.LinuxDeviceCgroup{
		Type:   "c",
		Minor:  &fuseDeviceMinor,
		Major:  &fuseDeviceMajor,
		Access: "rw",
		Allow:  true,
	}

	containerConf.Linux.Resources.Devices = append(containerConf.Linux.Resources.Devices, fuseDeviceResource)

	confJson, err = json.MarshalIndent(containerConf, "", "    ")
	if err != nil {
		return xerrors.Errorf("cannot encode config.json: %w", err)
	}

	confPaths := []string{containerConfPath}
	if cfg.Debug {
		debugConfPath := "/tmp/debug_" + os.Args[len(os.Args)-1] + ".json"
		confPaths = append(confPaths, debugConfPath)
	}

	for _, confPath := range confPaths {
		err = os.WriteFile(confPath, confJson, 0644)
		if err != nil {
			return xerrors.Errorf("cannot encode config.json: %w", err)
		}
	}

	err = syscall.Exec(runcPath, os.Args, os.Environ())
	if err != nil {
		return xerrors.Errorf("exec %s: %w", runcPath, err)
	}

	return nil
}

func getBundleDir() (string, error) {
	var bundleDir string
	for i, arg := range os.Args {
		if arg == "--bundle" && len(os.Args) > i+1 {
			bundleDir = os.Args[i+1]
		}
	}

	if bundleDir == "" {
		return "", xerrors.New("could not determine bundle directory")
	}

	return bundleDir, nil
}

func getConfig() (*facadeConfig, error) {
	_, err := os.Stat(FacadeConfigPath)
	if os.IsNotExist(err) {
		return DefaultConfig(), nil
	} else {
		f, err := os.ReadFile(FacadeConfigPath)
		if err != nil {
			return nil, err
		}

		var config facadeConfig
		if err := json.Unmarshal(f, &config); err != nil {
			return nil, err
		}

		return &config, nil
	}
}

func setupLogging(cfg *facadeConfig) {
	Log = logrus.New()
	if cfg.Debug {
		Log.SetLevel(logrus.DebugLevel)
	} else {
		Log.SetLevel(logrus.WarnLevel)
	}
}

func shouldUseFacade() bool {
	var useFacade bool
	for _, arg := range os.Args {
		if arg == "create" {
			useFacade = true
			break
		}
	}

	return useFacade
}

type facadeConfig struct {
	Runtime string
	Debug   bool
}

func DefaultConfig() *facadeConfig {
	return &facadeConfig{
		Runtime: "runc",
		Debug:   false,
	}
}
