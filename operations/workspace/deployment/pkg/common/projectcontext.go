package common

// ProjectContext is a wrapper which contains information required to communicate to the
// right GCP project with correct inputs
type ProjectContext struct {
	ID          string
	Environment Environment
}
