// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

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
	config    string
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
	Use:     "list <prefix>",
	Short:   "list",
	Args:    cobra.ExactArgs(1),
	Example: "list test-owner/",
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
	Use:     "upload",
	Short:   "upload",
	Example: "upload --path ./backup.tar --name workspace-backup --to-instance",
	RunE: func(cmd *cobra.Command, args []string) error {
		direct, err := createDirectAccess()
		if err != nil {
			return err
		}

		var bucket string
		var object string

		if uploadOpts.instance {
			bucket, object, err = direct.UploadInstance(context.Background(), uploadOpts.path, uploadOpts.name)
		} else {
			bucket, object, err = direct.Upload(context.Background(), uploadOpts.path, uploadOpts.name)
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
	Use:     "download",
	Short:   "download",
	Example: "download --dest ./download --name workspace-backup",
	RunE: func(cmd *cobra.Command, args []string) error {
		direct, err := createDirectAccess()
		if err != nil {
			return err
		}

		_, err = direct.Download(context.Background(), downloadOpts.destination, downloadOpts.name, []archive.IDMapping{})
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
	Use:     "upload <key>",
	Short:   "upload",
	Args:    cobra.ExactArgs(1),
	Example: "upload gitpod-signed",
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		info, err := presigned.SignUpload(context.Background(), "", args[0], &storage.SignedURLOptions{})
		if err != nil {
			return err
		}

		fmt.Printf("%s\n", info.URL)
		return nil
	},
}

var presignedDownloadCmd = &cobra.Command{
	Use:     "download <key>",
	Short:   "download",
	Args:    cobra.ExactArgs(1),
	Example: "download test-owner/workspaces/test-workspace/gitpod-upload",
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		info, err := presigned.SignDownload(context.Background(), "", args[0], &storage.SignedURLOptions{})
		if err != nil {
			return err
		}

		fmt.Printf("%s\n", info.URL)
		return nil
	},
}

var presignedUsageCmd = &cobra.Command{
	Use:     "usage <prefix>",
	Short:   "usage",
	Args:    cobra.ExactArgs(1),
	Example: "usage test-owner/",
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		size, err := presigned.DiskUsage(context.Background(), "", args[0])
		if err != nil {
			return err
		}

		fmt.Printf("%v\n", size)

		return nil
	},
}

var presignedExistsCmd = &cobra.Command{
	Use:     "exists <key>",
	Short:   "exists",
	Args:    cobra.ExactArgs(1),
	Example: "exists test-owner/workspaces/test-workspace/gitpod-upload",
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		exists, err := presigned.ObjectExists(context.Background(), "", args[0])
		if err != nil {
			return err
		}
		fmt.Printf("%v\n", exists)

		return nil
	},
}

var presignedDeleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "delete",
}

var presignedDeleteBucketUserId string
var presignedDeleteBucketCmd = &cobra.Command{
	Use:     "bucket <bucket>",
	Short:   "bucket",
	Args:    cobra.ExactArgs(1),
	Example: "delete bucket gitpod-s3",
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		if err = presigned.DeleteBucket(context.Background(), presignedDeleteBucketUserId, args[0]); err != nil {
			return err
		}

		return nil
	},
}

var presignedDeleteObjectCmd = &cobra.Command{
	Use:     "object <key>",
	Short:   "object",
	Args:    cobra.ExactArgs(1),
	Example: "delete object test-owner/backup.tar",
	RunE: func(cmd *cobra.Command, args []string) error {
		presigned, err := createPresignedAccess()
		if err != nil {
			return err
		}

		if err := presigned.DeleteObject(context.Background(), "", &storage.DeleteObjectQuery{Prefix: args[0]}); err != nil {
			return err
		}

		return nil
	},
}

func createDirectAccess() (direct storage.DirectAccess, err error) {
	var cfg *config.StorageConfig
	if options.config != "" {
		cfg, err = getTestConfig(options.config)
		if err != nil {
			return nil, err
		}

	} else {
		cfg = &config.StorageConfig{
			Kind: config.S3Storage,
			S3Config: &config.S3Config{
				Bucket:          "gitpod-s3",
				Region:          "eu-central-1",
				CredentialsFile: "./credentials",
			},
		}
	}

	direct, err = storage.NewDirectAccess(cfg)
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

func createPresignedAccess() (presigned storage.PresignedAccess, err error) {
	var cfg *config.StorageConfig
	if options.config != "" {
		cfg, err = getTestConfig(options.config)
		if err != nil {
			return nil, err
		}

	} else {
		cfg = &config.StorageConfig{
			Kind: config.S3Storage,
			S3Config: &config.S3Config{
				Bucket:          "gitpod-s3",
				Region:          "eu-central-1",
				CredentialsFile: "./credentials",
			},
		}
	}

	presigned, err = storage.NewPresignedAccess(cfg)
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

func getTestConfig(path string) (*config.StorageConfig, error) {
	ctnt, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg config.StorageConfig
	err = json.Unmarshal(ctnt, &cfg)
	if err != nil {
		return nil, err
	}

	return &cfg, nil
}

func init() {
	// direct
	directCmd.PersistentFlags().StringVar(&options.owner, "owner", "test-owner", "owner")
	directCmd.PersistentFlags().StringVar(&options.workspace, "workspace", "test-workspace", "workspace")
	directCmd.PersistentFlags().StringVar(&options.instance, "instance", "test-instance", "instance")

	directUploadCmd.PersistentFlags().StringVar(&uploadOpts.path, "path", "", "path of the file to be uploaded")
	directUploadCmd.PersistentFlags().StringVar(&uploadOpts.name, "name", "", "name that will be used for the blob in object storage")
	directUploadCmd.PersistentFlags().BoolVar(&uploadOpts.instance, "to-instance", false, "save to workspace or instance folder")

	directDownloadCmd.PersistentFlags().StringVar(&downloadOpts.destination, "dest", "", "destination of downloaded file")
	directDownloadCmd.PersistentFlags().StringVar(&downloadOpts.name, "name", "", "name of the blob in S3")

	directCmd.AddCommand(directListCmd)
	directCmd.AddCommand(directUploadCmd)
	directCmd.AddCommand(directDownloadCmd)

	// presigned
	presignedDeleteBucketCmd.PersistentFlags().StringVar(&presignedDeleteBucketUserId, "userId", "test-owner", "userId")
	presignedDeleteCmd.AddCommand(presignedDeleteBucketCmd)
	presignedDeleteCmd.AddCommand(presignedDeleteObjectCmd)

	presignedCmd.AddCommand(presignedUploadCmd)
	presignedCmd.AddCommand(presignedDownloadCmd)
	presignedCmd.AddCommand(presignedUsageCmd)
	presignedCmd.AddCommand(presignedExistsCmd)
	presignedCmd.AddCommand(presignedDeleteCmd)

	// test
	testCmd.PersistentFlags().StringVar(&options.config, "config", "", "config path")

	testCmd.AddCommand(directCmd)
	testCmd.AddCommand(presignedCmd)

	rootCmd.AddCommand(testCmd)
}
