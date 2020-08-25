.PHONY: init
init:
	terraform init

.PHONY: refresh
refresh: init
	terraform refresh

.PHONY: test
test: refresh
	terraform plan

.PHONY: install
install: test
	terraform apply --auto-approve

.PHONY: uninstall
uninstall: refresh
	terraform destroy --auto-approve