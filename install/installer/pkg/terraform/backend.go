package terraform

import (
	"os"

	"github.com/zclconf/go-cty/cty"
)

// ConfigureGCPBackend will create or update a terraform GCS backend with the provided
// bucketName and prefix
func ConfigureGCPBackend(backendFilePath, bucketName, prefix string) error {
	tfFile, err := loadOrCreateFile(backendFilePath)
	if err != nil {
		return err
	}

	tfBlock := tfFile.Body().FirstMatchingBlock("terraform", nil)
	if tfBlock == nil {
		tfBlock = tfFile.Body().AppendNewBlock("terraform", nil)
	}

	tfGCSBackend := tfBlock.Body().FirstMatchingBlock("backend", []string{"gcs"})
	if tfGCSBackend == nil {
		tfGCSBackend = tfBlock.Body().AppendNewBlock("backend", []string{"gcs"})
	}

	tfGCSBackend.Body().SetAttributeValue("bucket", cty.StringVal(bucketName))
	tfGCSBackend.Body().SetAttributeValue("prefix", cty.StringVal(prefix))

	f, err := os.OpenFile(backendFilePath, os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = tfFile.WriteTo(f)
	if err != nil {
		return err
	}
	return nil
}
