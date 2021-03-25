// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package protocol

import (
	"context"
	"os"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

// ConfigInterface provides access to the gitpod config file.
type ConfigInterface interface {
	// Observe provides channels triggered whenever the config is changed or errored
	Observe(ctx context.Context) (<-chan *GitpodConfig, <-chan error)
}

// ConfigService provides access to the gitpod config file.
type ConfigService struct {
	location      string
	locationReady <-chan struct{}

	config    *GitpodConfig
	listeners map[configListener]struct{}
	stop      context.CancelFunc
	mu        sync.Mutex
	pollTimer *time.Timer

	log *logrus.Entry
}

type configListener struct {
	configs chan *GitpodConfig
	errors  chan error
}

// NewConfigService creates a new instance of ConfigService
func NewConfigService(configLocation string, locationReady <-chan struct{}, log *logrus.Entry) *ConfigService {
	return &ConfigService{
		location:      configLocation,
		locationReady: locationReady,
		listeners:     make(map[configListener]struct{}),
		log:           log,
	}
}

// Observe provides channels triggered whenever the config is changed or errored
func (service *ConfigService) Observe(ctx context.Context) (<-chan *GitpodConfig, <-chan error) {
	listener := configListener{
		configs: make(chan *GitpodConfig),
		errors:  make(chan error),
	}

	go func() {
		defer close(listener.configs)
		defer close(listener.errors)

		select {
		case <-ctx.Done():
			return
		case <-service.locationReady:
		}

		err := service.start()
		if err != nil {
			// failed to start
			listener.errors <- err
			return
		}
		listener.configs <- service.config

		service.mu.Lock()
		service.listeners[listener] = struct{}{}
		service.mu.Unlock()

		<-ctx.Done()

		service.mu.Lock()
		delete(service.listeners, listener)
		if len(service.listeners) == 0 && service.stop != nil {
			service.stop()
			service.stop = nil
		}
		service.mu.Unlock()
	}()
	return listener.configs, listener.errors
}

func (service *ConfigService) start() error {
	service.mu.Lock()
	if service.stop != nil {
		// alread running
		service.mu.Unlock()
		return nil
	}

	service.log.WithField("location", service.location).Info("Starting watching...")
	context, stop := context.WithCancel(context.Background())
	service.stop = stop
	service.mu.Unlock()

	_, err := os.Stat(service.location)
	if os.IsNotExist(err) {
		go service.poll(context)
		return nil
	}
	err = service.watch(context)
	if err != nil {
		return err
	}
	return nil
}

func (service *ConfigService) watch(ctx context.Context) (err error) {
	watcher, err := fsnotify.NewWatcher()
	defer func() {
		if err != nil {
			service.log.WithField("location", service.location).WithError(err).Error("Failed to start watching...")
			return
		}

		service.log.WithField("location", service.location).Info("Started watching")
	}()
	if err != nil {
		return err
	}

	err = watcher.Add(service.location)
	if err != nil {
		watcher.Close()
		return err
	}

	go func() {
		defer service.log.WithField("location", service.location).Info("Stopped watching")
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
				service.dispatchError(err)
			case <-watcher.Events:
				service.scheduleUpdateConfig(ctx, polling)
			}
		}
	}()

	return nil
}

func (service *ConfigService) scheduleUpdateConfig(ctx context.Context, polling chan<- struct{}) {
	service.mu.Lock()
	defer service.mu.Unlock()
	if service.pollTimer != nil {
		service.pollTimer.Stop()
	}
	service.pollTimer = time.AfterFunc(100*time.Millisecond, func() {
		err := service.updateConfig()
		if os.IsNotExist(err) {
			polling <- struct{}{}
			go service.poll(ctx)
		} else if err != nil {
			service.dispatchError(err)
		}
	})
}

func (service *ConfigService) dispatchError(err error) {
	service.mu.Lock()
	defer service.mu.Unlock()
	for listener := range service.listeners {
		listener.errors <- err
	}
}

func (service *ConfigService) poll(ctx context.Context) {
	timer := time.NewTicker(2 * time.Second)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}

		if _, err := os.Stat(service.location); !os.IsNotExist(err) {
			_ = service.watch(ctx)
			return
		}
	}
}

func (service *ConfigService) updateConfig() error {
	service.mu.Lock()
	defer service.mu.Unlock()

	config, err := service.parse()
	service.config = config
	for listener := range service.listeners {
		listener.configs <- service.config
	}
	return err
}

func (service *ConfigService) parse() (*GitpodConfig, error) {
	data, err := os.ReadFile(service.location)
	if err != nil {
		return nil, err
	}
	var config *GitpodConfig
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		return nil, err
	}
	return config, nil
}
