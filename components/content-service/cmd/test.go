// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/spf13/cobra"
)

var options testOpts

type testOpts struct {
	owner     string
	workspace string
	instance  string
}

var testCmd = &cobra.Command{
	Use:   "test",
	Short: "Test the content service",
}

var directCmd = &cobra.Command{
	Use:   "direct",
	Short: "direct",
}

var directListCmd = &cobra.Command{
	Use:   "list <prefix>",
	Short: "list",

	RunE: func(cmd *cobra.Command, args []string) error {
		direct, err := createDirectAccess()
		if err != nil {
			return err
		}

		objects, err := direct.ListObjects(context.Background(), args[0])
		if err != nil {
			return err
		}

		for _, o := range objects {
			fmt.Printf("object: %s\n", o)
		}

		return nil
	},
}

var uploadOpts testUploadOpts

type testUploadOpts struct {
	path     string
	name     string
	instance bool
}

var directUploadCmd = &cobra.Command{
	Use:   "upload",
	Short: "upload",

	RunE: func(cmd *cobra.Command, args []string) error {
		direct, err := createDirectAccess()
		if err != nil {
			return err
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var bucket string
		var object string

		if uploadOpts.instance {
			bucket, object, err = direct.UploadInstance(ctx, uploadOpts.path, uploadOpts.name)
		} else {
			bucket, object, err = direct.Upload(ctx, uploadOpts.path, uploadOpts.name)
		}

		if err != nil {
			return err
		}

		fmt.Printf("bucket: %s, object: %s\n", bucket, object)

		return nil
	},
}

var downloadOpts testDownloadOpts

type testDownloadOpts struct {
	destination string
	name        string
}

var directDownloadCmd = &cobra.Command{
	Use:   "download",
	Short: "download",

	RunE: func(cmd *cobra.Command, args []string) error {
		direct, err := createDirectAccess()
		if err != nil {
			return err
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		log.Infof("opts: %+v", downloadOpts)
		_, err = direct.Download(ctx, downloadOpts.destination, downloadOpts.name, []archive.IDMapping{
			{
				HostID:      0,
				ContainerID: 0,
				Size:        1,
			},
		})
		if err != nil {
			return err
		}

		return nil
	},
}

var presignedCmd = &cobra.Command{
	Use:   "presigned",
	Short: "presigned",
}

var presignedUploadCmd = &cobra.Command{
	Use:   "upload <key>",
	Short: "upload",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		info, err := presigned.SignUpload(ctx, "", args[0], &storage.SignedURLOptions{})
		if err != nil {
			return err
		}

		fmt.Printf("%s\n", info.URL)
		return nil
	},
}

var presignedDownloadCmd = &cobra.Command{
	Use:   "download <key>",
	Short: "download",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		info, err := presigned.SignDownload(ctx, "", args[0], &storage.SignedURLOptions{})
		if err != nil {
			return err
		}

		fmt.Printf("%s\n", info.URL)
		return nil
	},
}

var presignedUsageCmd = &cobra.Command{
	Use:   "usage <prefix>",
	Short: "usage",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		size, err := presigned.DiskUsage(ctx, "", args[0])
		if err != nil {
			return err
		}

		fmt.Printf("%v\n", size)

		return nil
	},
}

var presignedExistsCmd = &cobra.Command{
	Use:   "exists <key>",
	Short: "exists",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		exists, err := presigned.ObjectExists(ctx, "", args[0])
		if err != nil {
			return err
		}
		fmt.Printf("%v", exists)

		return nil
	},
}

func createDirectAccess() (storage.DirectAccess, error) {
	cfg := &config.StorageConfig{
		Kind: config.S3Storage,
		S3Config: &config.S3Config{
			Bucket: "gitpod-s3",
		},
	}

	direct, err := storage.NewDirectAccess(cfg)
	if err != nil {
		return nil, err
	}

	if err = direct.Init(context.TODO(), options.owner, options.workspace, options.instance); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err = direct.EnsureExists(ctx); err != nil {
		return nil, err
	}

	return direct, nil
}

func createPresignedAccess() (storage.PresignedAccess, error) {
	cfg := &config.StorageConfig{
		Kind: config.S3Storage,
		S3Config: &config.S3Config{
			Bucket: "gitpod-s3",
		},
	}

	presigned, err := storage.NewPresignedAccess(cfg)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err = presigned.EnsureExists(ctx, cfg.S3Config.Bucket); err != nil {
		return nil, err
	}

	return presigned, nil
}

func init() {
	// direct
	directUploadCmd.PersistentFlags().StringVar(&uploadOpts.path, "path", "", "path")
	directUploadCmd.PersistentFlags().StringVar(&uploadOpts.name, "name", "", "name")
	directUploadCmd.PersistentFlags().BoolVar(&uploadOpts.instance, "to-instance", false, "to instance")

	directDownloadCmd.PersistentFlags().StringVar(&downloadOpts.destination, "dest", "", "dest")
	directDownloadCmd.PersistentFlags().StringVar(&downloadOpts.name, "name", "", "name")

	directCmd.AddCommand(directListCmd)
	directCmd.AddCommand(directUploadCmd)
	directCmd.AddCommand(directDownloadCmd)

	// presigned
	presignedCmd.AddCommand(presignedUploadCmd)
	presignedCmd.AddCommand(presignedDownloadCmd)
	presignedCmd.AddCommand(presignedUsageCmd)
	presignedCmd.AddCommand(presignedExistsCmd)

	// test
	testCmd.PersistentFlags().StringVar(&options.owner, "owner", "test-owner", "owner")
	testCmd.PersistentFlags().StringVar(&options.workspace, "workspace", "test-workspace", "workspace")
	testCmd.PersistentFlags().StringVar(&options.instance, "instance", "test-instance", "instance")

	testCmd.AddCommand(directCmd)
	testCmd.AddCommand(presignedCmd)

	rootCmd.AddCommand(testCmd)
}
