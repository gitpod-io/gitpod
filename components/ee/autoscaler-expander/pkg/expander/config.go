package expander

import "context"

type Config struct {
	WorkspaceClassPerNode map[string]int `json:"workspaceClassPerNode"`
}

type ConfigReloader interface {
	ReloadConfig(context.Context, *Config) error
}

type ConfigReloaderFunc func(context.Context, *Config) error

func (f ConfigReloaderFunc) ReloadConfig(ctx context.Context, cfg *Config) error {
	return f(ctx, cfg)
}

type CompositeConfigReloader []ConfigReloader

func (cs CompositeConfigReloader) ReloadConfig(ctx context.Context, cfg *Config) error {
	for _, c := range cs {
		err := c.ReloadConfig(ctx, cfg)
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}
	}
	return nil
}
