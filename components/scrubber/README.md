# scrubber
Scrubber is the library we use to scrub data from PII and other sensitive information.

This code is located in `components/` instead of `components/common-go/scrubber` to reduce the number of transitive depencies we're introducing to consumers of this package.
