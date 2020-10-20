// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"sync"

	"github.com/gitpod-io/gitpod/supervisor/pkg/gitpod"
)

// ConfigInterface provides access to port configurations
type ConfigInterface interface {
	// Get returns the config for the give port
	Get(port uint32) (*gitpod.PortConfig, bool)
	// ForEach iteraters through port configs
	ForEach(callback func(port uint32, config *gitpod.PortConfig))
	// Observe provides channels triggered whenever the port configurations are changed
	Observe(ctx context.Context) (<-chan struct{}, <-chan error)
}

// ConfigService provides access to port configurations
type ConfigService struct {
	workspaceID   string
	configService *gitpod.ConfigService
	gitpodAPI     gitpod.APIInterface

	workspaceConfigs     map[uint32]*gitpod.PortConfig
	instancePortConfigs  map[uint32]*gitpod.PortConfig
	instanceRangeConfigs []*rangeConfig
	mutex                sync.RWMutex
}

type rangeConfig struct {
	*gitpod.PortsItems
	start uint32
	end   uint32
}

// NewConfigService creates a new instance of ConfigService
func NewConfigService(workspaceID string, configService *gitpod.ConfigService, gitpodAPI gitpod.APIInterface) *ConfigService {
	return &ConfigService{
		workspaceID:   workspaceID,
		configService: configService,
		gitpodAPI:     gitpodAPI,
	}
}

// Get returns the config for the give port
func (service *ConfigService) Get(port uint32) (*gitpod.PortConfig, bool) {
	service.mutex.RLock()
	defer service.mutex.RUnlock()

	config, exists := service.instancePortConfigs[port]
	if exists {
		return config, true
	}
	config, exists = service.workspaceConfigs[port]
	if exists {
		return config, true
	}
	for _, rangeConfig := range service.instanceRangeConfigs {
		if rangeConfig.start <= port && port <= rangeConfig.end {
			return &gitpod.PortConfig{
				Port:       float64(port),
				OnOpen:     rangeConfig.OnOpen,
				Visibility: rangeConfig.Visibility,
			}, true
		}
	}
	return nil, false
}

// ForEach iteraters through port configs
func (service *ConfigService) ForEach(callback func(port uint32, config *gitpod.PortConfig)) {
	service.mutex.RLock()
	defer service.mutex.RUnlock()

	for port, config := range service.instancePortConfigs {
		callback(port, config)
	}
	for port, config := range service.workspaceConfigs {
		_, exists := service.instancePortConfigs[port]
		if !exists {
			callback(port, config)
		}
	}
}

// Observe provides channels triggered whenever the port configurations are changed
func (service *ConfigService) Observe(ctx context.Context) (<-chan struct{}, <-chan error) {
	updates := make(chan struct{})
	errors := make(chan error, 1)

	portRangeRegexp := regexp.MustCompile("/[-:]/")
	go func() {
		defer close(updates)
		defer close(errors)

		info, err := service.gitpodAPI.GetWorkspace(ctx, service.workspaceID)
		if err != nil {
			errors <- err
		} else {
			configs := make(map[uint32]*gitpod.PortConfig)
			for _, config := range info.Workspace.Config.Ports {
				port := uint32(config.Port)
				_, exists := configs[port]
				if !exists {
					configs[port] = config
				}
			}

			service.mutex.Lock()
			service.workspaceConfigs = configs
			service.mutex.Unlock()
			updates <- struct{}{}
		}

		configs, errs := service.configService.Observe(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case config := <-configs:
				portConfigs := make(map[uint32]*gitpod.PortConfig)
				var rangeConfigs []*rangeConfig
				for _, config := range config.Ports {
					Port, ok := config.Port.(float64)
					if ok {
						port := uint32(Port)
						_, exists := portConfigs[port]
						if !exists {
							continue
						}
						portConfigs[port] = &gitpod.PortConfig{
							OnOpen:     config.OnOpen,
							Port:       Port,
							Visibility: config.Visibility,
						}
						continue
					}
					portRange := portRangeRegexp.Split(fmt.Sprintf("%v", config.Port), 2)
					if len(portRange) != 2 {
						continue
					}
					start, err := strconv.Atoi(portRange[0])
					if err != nil {
						continue
					}
					end, err := strconv.Atoi(portRange[1])
					if err != nil || end >= start {
						continue
					}
					rangeConfigs = append(rangeConfigs, &rangeConfig{
						PortsItems: config,
						start:      uint32(start),
						end:        uint32(end),
					})
				}

				service.mutex.Lock()
				service.instancePortConfigs = portConfigs
				service.instanceRangeConfigs = rangeConfigs
				service.mutex.Unlock()
				updates <- struct{}{}
			case err := <-errs:
				errors <- err
			}
		}
	}()
	return updates, errors
}
