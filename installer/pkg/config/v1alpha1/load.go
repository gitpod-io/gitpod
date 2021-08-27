package config

import (
	"io/ioutil"

	"sigs.k8s.io/yaml"
)

func Load(fn string) (*Config, error) {
	fc, err := ioutil.ReadFile(fn)
	if err != nil {
		return nil, err
	}

	var cfg Config
	err = yaml.UnmarshalStrict(fc, &cfg)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}
