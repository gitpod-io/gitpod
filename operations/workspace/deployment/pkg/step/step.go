package step

// IStep is an interface that should be implemented by all steps of cluster lifecycle
type IStep interface {
	Run() error
}
