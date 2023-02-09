// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"context"
	"os"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

// ConfigInterface provides access to the gitpod config file.
type ConfigInterface interface {
	// Watch starts the config watching
	Watch(ctx context.Context)
	// Observe provides channels triggered whenever the config is changed
	Observe(ctx context.Context) <-chan *gitpod.GitpodConfig
}

// ConfigService provides access to the gitpod config file.
type ConfigService struct {
	location      string
	locationReady <-chan struct{}

	cond   *sync.Cond
	config *gitpod.GitpodConfig

	pollTimer *time.Timer

	log *logrus.Entry

	ready     chan struct{}
	readyOnce sync.Once

	debounceDuration time.Duration
}

// NewConfigService creates a new instance of ConfigService.
func NewConfigService(configLocation string, locationReady <-chan struct{}, log *logrus.Entry) *ConfigService {
	return &ConfigService{
		location:         configLocation,
		locationReady:    locationReady,
		cond:             sync.NewCond(&sync.Mutex{}),
		log:              log.WithField("location", configLocation),
		ready:            make(chan struct{}),
		debounceDuration: 100 * time.Millisecond,
	}
}

// Observe provides channels triggered whenever the config is changed.
func (service *ConfigService) Observe(ctx context.Context) <-chan *gitpod.GitpodConfig {
	configs := make(chan *gitpod.GitpodConfig)
	go func() {
		defer close(configs)

		<-service.ready

		service.cond.L.Lock()
		defer service.cond.L.Unlock()
		for {
			configs <- service.config

			service.cond.Wait()
			if ctx.Err() != nil {
				return
			}
		}
	}()
	return configs
}

// Watch starts the config watching.
func (service *ConfigService) Watch(ctx context.Context) {
	service.log.Info("gitpod config watcher: starting...")

	select {
	case <-service.locationReady:
	case <-ctx.Done():
		return
	}

	service.waitUntilExistsAndWatch(ctx)
}

func (service *ConfigService) markReady() {
	service.readyOnce.Do(func() {
		close(service.ready)
	})
}

func (service *ConfigService) watch(ctx context.Context) {
	watcher, err := fsnotify.NewWatcher()
	defer func() {
		if err != nil {
			service.log.WithError(err).Error("gitpod config watcher: failed to start")
			return
		}

		service.log.Info("gitpod config watcher: started")
	}()
	if err != nil {
		return
	}

	err = watcher.Add(service.location)
	if err != nil {
		watcher.Close()
		return
	}

	go func() {
		defer service.log.Info("gitpod config watcher: stopped")
		defer watcher.Close()

		polling := make(chan struct{}, 1)
		service.scheduleUpdateConfig(ctx, polling)
		for {
			select {
			case <-polling:
				return
			case <-ctx.Done():
				return
			case err := <-watcher.Errors:
				service.log.WithError(err).Error("gitpod config watcher: failed to watch")
			case <-watcher.Events:
				service.scheduleUpdateConfig(ctx, polling)
			}
		}
	}()
}

func (service *ConfigService) scheduleUpdateConfig(ctx context.Context, polling chan<- struct{}) {
	service.cond.L.Lock()
	defer service.cond.L.Unlock()
	if service.pollTimer != nil {
		service.pollTimer.Stop()
	}
	service.pollTimer = time.AfterFunc(service.debounceDuration, func() {
		err := service.updateConfig()
		if os.IsNotExist(err) {
			polling <- struct{}{}
			go service.waitUntilExistsAndWatch(ctx)
		} else if err != nil {
			service.log.WithError(err).Error("gitpod config watcher: failed to parse")
		}
	})
}

func (service *ConfigService) waitUntilExistsAndWatch(ctx context.Context) {
	service.markReady()

	timer := time.NewTicker(2 * time.Second)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}

		if _, err := os.Stat(service.location); !os.IsNotExist(err) {
			service.watch(ctx)
			return
		}
	}
}

func (service *ConfigService) updateConfig() error {
	service.cond.L.Lock()
	defer service.cond.L.Unlock()

	config, err := service.parse()
	if err == nil || os.IsNotExist(err) {
		service.config = config
		service.markReady()
		service.cond.Broadcast()

		service.log.WithField("config", service.config).Debug("gitpod config watcher: updated")
	}

	return err
}

func (service *ConfigService) parse() (*gitpod.GitpodConfig, error) {
	data, err := os.ReadFile(service.location)
	if err != nil {
		return nil, err
	}
	var config *gitpod.GitpodConfig
	err = yaml.Unmarshal(data, &config)
	return config, err
}
