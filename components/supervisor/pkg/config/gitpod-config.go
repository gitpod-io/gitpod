// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"gopkg.in/yaml.v3"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

// ConfigInterface provides access to the gitpod config file.
type ConfigInterface interface {
	// Watch starts the config watching
	Watch(ctx context.Context)
	// Observe provides channels triggered whenever the config is changed
	Observe(ctx context.Context) <-chan *gitpod.GitpodConfig
	// Observe provides channels triggered whenever the image file is changed
	ObserveImageFile(ctx context.Context) <-chan *struct{}
}

// ConfigService provides access to the gitpod config file.
type ConfigService struct {
	locationReady <-chan struct{}

	configLocation string
	configWatcher  *fileWatcher[gitpod.GitpodConfig]

	imageWatcher *fileWatcher[struct{}]
}

// NewConfigService creates a new instance of ConfigService.
func NewConfigService(configLocation string, locationReady <-chan struct{}) *ConfigService {
	return &ConfigService{
		locationReady:  locationReady,
		configLocation: configLocation,
		configWatcher: newFileWatcher(func(data []byte) (*gitpod.GitpodConfig, error) {
			var config *gitpod.GitpodConfig
			err := yaml.Unmarshal(data, &config)
			return config, err
		}),
		imageWatcher: newFileWatcher(func(data []byte) (*struct{}, error) {
			return &struct{}{}, nil
		}),
	}
}

// Observe provides channels triggered whenever the config is changed.
func (service *ConfigService) Observe(ctx context.Context) <-chan *gitpod.GitpodConfig {
	return service.configWatcher.observe(ctx)
}

// Observe provides channels triggered whenever the image file is changed
func (service *ConfigService) ObserveImageFile(ctx context.Context) <-chan *struct{} {
	return service.imageWatcher.observe(ctx)
}

// Watch starts the config watching.
func (service *ConfigService) Watch(ctx context.Context) {
	select {
	case <-service.locationReady:
	case <-ctx.Done():
		return
	}
	go service.watchImageFile(ctx)
	service.configWatcher.watch(ctx, service.configLocation)
}

func (service *ConfigService) watchImageFile(ctx context.Context) {
	var (
		imageLocation string
		cancelWatch   func()
	)
	defer func() {
		if cancelWatch != nil {
			cancelWatch()
		}
	}()
	cfgs := service.configWatcher.observe(ctx)
	for {
		select {
		case cfg, ok := <-cfgs:
			if !ok {
				return
			}
			var currentImageLocation string
			if cfg != nil {
				switch img := cfg.Image.(type) {
				case map[string]interface{}:
					if file, ok := img["file"].(string); ok {
						currentImageLocation = filepath.Join(filepath.Dir(service.configLocation), file)
					}
				}
			}
			if imageLocation == currentImageLocation {
				continue
			}
			if cancelWatch != nil {
				cancelWatch()
				cancelWatch = nil
				service.imageWatcher.reset()
			}
			imageLocation = currentImageLocation
			if imageLocation == "" {
				continue
			}
			watchCtx, cancel := context.WithCancel(ctx)
			cancelWatch = cancel
			go service.imageWatcher.watch(watchCtx, imageLocation)
		case <-ctx.Done():
			return
		}
	}
}

type fileWatcher[T any] struct {
	unmarshal func(data []byte) (*T, error)

	cond *sync.Cond
	data *T

	pollTimer *time.Timer

	ready     chan struct{}
	readyOnce sync.Once

	debounceDuration time.Duration
}

func newFileWatcher[T any](unmarshal func(data []byte) (*T, error)) *fileWatcher[T] {
	return &fileWatcher[T]{
		unmarshal:        unmarshal,
		cond:             sync.NewCond(&sync.Mutex{}),
		ready:            make(chan struct{}),
		debounceDuration: 100 * time.Millisecond,
	}
}

func (service *fileWatcher[T]) observe(ctx context.Context) <-chan *T {
	results := make(chan *T)
	go func() {
		defer close(results)

		<-service.ready

		service.cond.L.Lock()
		defer service.cond.L.Unlock()
		for {
			results <- service.data

			service.cond.Wait()
			if ctx.Err() != nil {
				return
			}
		}
	}()
	return results
}

func (service *fileWatcher[T]) markReady() {
	service.readyOnce.Do(func() {
		close(service.ready)
	})
}

func (service *fileWatcher[T]) reset() {
	service.cond.L.Lock()
	defer service.cond.L.Unlock()

	if service.data != nil {
		service.data = nil
		service.cond.Broadcast()
	}
}

func (service *fileWatcher[T]) watch(ctx context.Context, location string) {
	log.WithField("location", location).Info("file watcher: starting...")

	_, err := os.Stat(location)
	if os.IsNotExist(err) {
		service.poll(ctx, location)
	} else {
		service.doWatch(ctx, location)
	}
}

func (service *fileWatcher[T]) doWatch(ctx context.Context, location string) {
	watcher, err := fsnotify.NewWatcher()
	defer func() {
		if err != nil {
			log.WithField("location", location).WithError(err).Error("file watcher: failed to start")
			return
		}

		log.WithField("location", location).Info("file watcher: started")
	}()
	if err != nil {
		return
	}

	err = watcher.Add(location)
	if err != nil {
		watcher.Close()
		return
	}

	go func() {
		defer log.WithField("location", location).Info("file watcher: stopped")
		defer watcher.Close()

		polling := make(chan struct{}, 1)
		service.scheduleUpdate(ctx, polling, location)
		for {
			select {
			case <-polling:
				return
			case <-ctx.Done():
				return
			case err := <-watcher.Errors:
				log.WithField("location", location).WithError(err).Error("file watcher: failed to watch")
			case <-watcher.Events:
				service.scheduleUpdate(ctx, polling, location)
			}
		}
	}()
}

func (service *fileWatcher[T]) scheduleUpdate(ctx context.Context, polling chan<- struct{}, location string) {
	service.cond.L.Lock()
	defer service.cond.L.Unlock()
	if service.pollTimer != nil {
		service.pollTimer.Stop()
	}
	service.pollTimer = time.AfterFunc(service.debounceDuration, func() {
		err := service.update(location)
		if os.IsNotExist(err) {
			polling <- struct{}{}
			go service.poll(ctx, location)
		} else if err != nil {
			log.WithField("location", location).WithError(err).Error("file watcher: failed to parse")
		}
	})
}

func (service *fileWatcher[T]) poll(ctx context.Context, location string) {
	service.markReady()

	timer := time.NewTicker(2 * time.Second)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}

		if _, err := os.Stat(location); !os.IsNotExist(err) {
			service.doWatch(ctx, location)
			return
		}
	}
}

func (service *fileWatcher[T]) update(location string) error {
	service.cond.L.Lock()
	defer service.cond.L.Unlock()

	data, err := service.parse(location)
	if err == nil || os.IsNotExist(err) {
		service.data = data
		service.markReady()
		service.cond.Broadcast()

		log.WithField("location", location).WithField("data", service.data).Debug("file watcher: updated")
	}

	return err
}

func (service *fileWatcher[T]) parse(location string) (*T, error) {
	data, err := os.ReadFile(location)
	if err != nil {
		return nil, err
	}
	return service.unmarshal(data)
}
