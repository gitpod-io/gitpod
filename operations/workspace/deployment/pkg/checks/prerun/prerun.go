package prerun

// IPreRun is an interface that should be implemented by all preruns checks
type IPreRun interface {
	Run() error
}
