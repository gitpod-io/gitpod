// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strconv"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/pkg/config"
)

// RangeConfig is a port range config.
type RangeConfig struct {
	*gitpod.PortsItems
	Start uint32
	End   uint32
}

// Configs provides access to port configurations.
type Configs struct {
	workspaceConfigs     map[uint32]*gitpod.PortConfig
	instancePortConfigs  map[uint32]*gitpod.PortConfig
	instanceRangeConfigs []*RangeConfig
}

// ForEach iterates over all configured ports.
func (configs *Configs) ForEach(callback func(port uint32, config *gitpod.PortConfig)) {
	if configs == nil {
		return
	}
	visited := make(map[uint32]struct{})
	for _, configs := range []map[uint32]*gitpod.PortConfig{configs.instancePortConfigs, configs.workspaceConfigs} {
		for port, config := range configs {
			_, exists := visited[port]
			if exists {
				continue
			}
			visited[port] = struct{}{}
			callback(port, config)
		}
	}
}

// ConfigKind indicates a type of config.
type ConfigKind uint8

var (
	// PortConfigKind is a port based config type.
	PortConfigKind ConfigKind = 0
	// RangeConfigKind is a range based config type.
	RangeConfigKind ConfigKind = 1
)

// Get returns the config for the give port.
func (configs *Configs) Get(port uint32) (*gitpod.PortConfig, ConfigKind, bool) {
	if configs == nil {
		return nil, PortConfigKind, false
	}
	config, exists := configs.instancePortConfigs[port]
	if exists {
		return config, PortConfigKind, true
	}
	config, exists = configs.workspaceConfigs[port]
	if exists {
		return config, PortConfigKind, true
	}
	for _, rangeConfig := range configs.instanceRangeConfigs {
		if rangeConfig.Start <= port && port <= rangeConfig.End {
			return &gitpod.PortConfig{
				Port:       float64(port),
				OnOpen:     rangeConfig.OnOpen,
				Visibility: rangeConfig.Visibility,
			}, RangeConfigKind, true
		}
	}
	return nil, PortConfigKind, false
}

// ConfigInterace allows to watch port configurations.
type ConfigInterace interface {
	// Observe provides channels triggered whenever the port configurations are changed.
	Observe(ctx context.Context) (<-chan *Configs, <-chan error)
}

// ConfigService allows to watch port configurations.
type ConfigService struct {
	workspaceID   string
	configService config.ConfigInterface
	gitpodAPI     gitpod.APIInterface
}

// NewConfigService creates a new instance of ConfigService.
func NewConfigService(workspaceID string, configService config.ConfigInterface, gitpodAPI gitpod.APIInterface) *ConfigService {
	return &ConfigService{
		workspaceID:   workspaceID,
		configService: configService,
		gitpodAPI:     gitpodAPI,
	}
}

// Observe provides channels triggered whenever the port configurations are changed.
func (service *ConfigService) Observe(ctx context.Context) (<-chan *Configs, <-chan error) {
	updatesChan := make(chan *Configs)
	errorsChan := make(chan error, 1)

	go func() {
		defer close(updatesChan)
		defer close(errorsChan)

		configs := service.configService.Observe(ctx)

		current := &Configs{}
		if service.gitpodAPI != nil {
			info, err := service.gitpodAPI.GetWorkspace(ctx, service.workspaceID)
			if err != nil {
				errorsChan <- err
			} else {
				current.workspaceConfigs = parseWorkspaceConfigs(info.Workspace.Config.Ports)
				updatesChan <- &Configs{workspaceConfigs: current.workspaceConfigs}
			}
		} else {
			errorsChan <- errors.New("could not connect to Gitpod API to fetch workspace port configs")
		}

		for {
			select {
			case <-ctx.Done():
				return
			case config, ok := <-configs:
				if !ok {
					return
				}
				changed := service.update(config, current)
				if !changed {
					continue
				}
				updatesChan <- &Configs{
					workspaceConfigs:     current.workspaceConfigs,
					instancePortConfigs:  current.instancePortConfigs,
					instanceRangeConfigs: current.instanceRangeConfigs,
				}
			}
		}
	}()
	return updatesChan, errorsChan
}

func (service *ConfigService) update(config *gitpod.GitpodConfig, current *Configs) bool {
	currentPortConfigs, currentRangeConfigs := current.instancePortConfigs, current.instanceRangeConfigs
	var ports []*gitpod.PortsItems
	if config != nil {
		ports = config.Ports
	}
	portConfigs, rangeConfigs := parseInstanceConfigs(ports)
	current.instancePortConfigs = portConfigs
	current.instanceRangeConfigs = rangeConfigs
	return !reflect.DeepEqual(currentPortConfigs, portConfigs) || !reflect.DeepEqual(currentRangeConfigs, rangeConfigs)
}

var portRangeRegexp = regexp.MustCompile(`^(\d+)[-:](\d+)$`)

func parseWorkspaceConfigs(ports []*gitpod.PortConfig) (portConfigs map[uint32]*gitpod.PortConfig) {
	if len(ports) == 0 {
		return nil
	}
	portConfigs = make(map[uint32]*gitpod.PortConfig)
	for _, config := range ports {
		port := uint32(config.Port)
		_, exists := portConfigs[port]
		if !exists {
			portConfigs[port] = config
		}
	}
	return portConfigs
}

func parseInstanceConfigs(ports []*gitpod.PortsItems) (portConfigs map[uint32]*gitpod.PortConfig, rangeConfigs []*RangeConfig) {
	for _, config := range ports {
		if config == nil {
			continue
		}

		rawPort := fmt.Sprintf("%v", config.Port)
		Port, err := strconv.ParseUint(rawPort, 10, 16)
		if err == nil {
			if portConfigs == nil {
				portConfigs = make(map[uint32]*gitpod.PortConfig)
			}
			port := uint32(Port)
			_, exists := portConfigs[port]
			if !exists {
				portConfigs[port] = &gitpod.PortConfig{
					OnOpen:     config.OnOpen,
					Port:       float64(Port),
					Visibility: config.Visibility,
				}
			}
			continue
		}
		matches := portRangeRegexp.FindStringSubmatch(rawPort)
		if len(matches) != 3 {
			continue
		}
		start, err := strconv.Atoi(matches[1])
		if err != nil {
			continue
		}
		end, err := strconv.Atoi(matches[2])
		if err != nil || start >= end {
			continue
		}
		rangeConfigs = append(rangeConfigs, &RangeConfig{
			PortsItems: config,
			Start:      uint32(start),
			End:        uint32(end),
		})
	}
	return portConfigs, rangeConfigs
}
