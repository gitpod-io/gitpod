// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"sync"

	"github.com/gitpod-io/gitpod/supervisor/pkg/gitpod"
)

// ConfigService provides access to port configurations
type ConfigService struct {
	workspaceID   string
	configService gitpod.ConfigInterface
	gitpodAPI     gitpod.APIInterface

	portRangeRegexp *regexp.Regexp

	workspaceConfigs     map[uint32]*gitpod.PortConfig
	instancePortConfigs  map[uint32]*gitpod.PortConfig
	instanceRangeConfigs []*RangeConfig
	mutex                sync.RWMutex
	ready                chan struct{}
}

// RangeConfig is a port range config
type RangeConfig struct {
	*gitpod.PortsItems
	Start uint32
	End   uint32
}

// NewConfigService creates a new instance of ConfigService
func NewConfigService(workspaceID string, configService gitpod.ConfigInterface, gitpodAPI gitpod.APIInterface) *ConfigService {
	return &ConfigService{
		workspaceID:     workspaceID,
		configService:   configService,
		gitpodAPI:       gitpodAPI,
		portRangeRegexp: regexp.MustCompile("^(\\d+)[-:](\\d+)$"),
		ready:           make(chan struct{}),
	}
}

// ForEach iterates over all configured ports (can return duplicate)
func (service *ConfigService) ForEach(callback func(port uint32, config *gitpod.PortConfig)) {
	for _, configs := range []map[uint32]*gitpod.PortConfig{service.instancePortConfigs, service.workspaceConfigs} {
		for port, config := range configs {
			callback(port, config)
		}
	}
}

// Get returns the config for the give port
func (service *ConfigService) Get(port uint32) (*gitpod.PortConfig, bool) {
	<-service.ready

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
	return service.GetRange(port)
}

// GetRange returns the range config for the give port
func (service *ConfigService) GetRange(port uint32) (*gitpod.PortConfig, bool) {
	<-service.ready
	for _, rangeConfig := range service.instanceRangeConfigs {
		if rangeConfig.Start <= port && port <= rangeConfig.End {
			return &gitpod.PortConfig{
				Port:       float64(port),
				OnOpen:     rangeConfig.OnOpen,
				Visibility: rangeConfig.Visibility,
			}, true
		}
	}
	return nil, false
}

// Observe provides channels triggered whenever the port configurations are changed
func (service *ConfigService) Observe(ctx context.Context) (<-chan struct{}, <-chan error) {
	updatesChan := make(chan struct{})
	errorsChan := make(chan error, 1)

	go func() {
		defer close(updatesChan)
		defer close(errorsChan)

		if service.gitpodAPI != nil {
			info, err := service.gitpodAPI.GetWorkspace(ctx, service.workspaceID)
			if err != nil {
				errorsChan <- err
			} else {
				service.mutex.Lock()
				for _, config := range info.Workspace.Config.Ports {
					if service.workspaceConfigs == nil {
						service.workspaceConfigs = make(map[uint32]*gitpod.PortConfig)
					}
					port := uint32(config.Port)
					_, exists := service.workspaceConfigs[port]
					if !exists {
						service.workspaceConfigs[port] = config
					}
				}
				service.mutex.Unlock()
			}
		} else {
			errorsChan <- errors.New("failed to fetch the worksapce info - no connection ot the gitpod server")
		}

		init := true
		configs, errs := service.configService.Observe(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case config := <-configs:
				service.update(config)
				if init {
					close(service.ready)
					init = false
				}
				updatesChan <- struct{}{}
			case err := <-errs:
				errorsChan <- err
			}
		}
	}()
	return updatesChan, errorsChan
}

func (service *ConfigService) update(config *gitpod.GitpodConfig) {
	service.mutex.Lock()
	defer service.mutex.Unlock()

	service.instancePortConfigs = nil
	service.instanceRangeConfigs = nil

	if config == nil {
		return
	}
	for _, config := range config.Ports {
		rawPort := fmt.Sprintf("%v", config.Port)
		Port, err := strconv.Atoi(rawPort)
		if err == nil {
			if service.instancePortConfigs == nil {
				service.instancePortConfigs = make(map[uint32]*gitpod.PortConfig)
			}
			port := uint32(Port)
			_, exists := service.instancePortConfigs[port]
			if !exists {
				service.instancePortConfigs[port] = &gitpod.PortConfig{
					OnOpen:     config.OnOpen,
					Port:       float64(Port),
					Visibility: config.Visibility,
				}
			}
			continue
		}
		matches := service.portRangeRegexp.FindStringSubmatch(rawPort)
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
		service.instanceRangeConfigs = append(service.instanceRangeConfigs, &RangeConfig{
			PortsItems: config,
			Start:      uint32(start),
			End:        uint32(end),
		})
	}
}
