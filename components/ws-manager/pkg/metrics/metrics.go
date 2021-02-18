package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

var _ prometheus.Gatherer = (*multiGatherer)(nil)

type multiGatherer struct {
	main       *prometheus.Registry
	additional []*prometheus.Registry
}

// MultiGatherer is an interface for the part of a registry in charge of gathering
// the collected metrics into a number of MetricFamilies.
// Also allows the gathering of metric of more than one registry.
// TODO: add validation of overlap metric definition
type MultiGatherer interface {
	prometheus.Gatherer
	// AddGatherer register an additional prometheus registry to gather metrics from
	AddGatherer(*prometheus.Registry)
}

// NewMultiGatherer creates a new
func NewMultiGatherer(main *prometheus.Registry) MultiGatherer {
	return &multiGatherer{
		main:       main,
		additional: make([]*prometheus.Registry, 0),
	}
}

// AddGatherer register an additional prometheus registry to gather metrics from
func (mg *multiGatherer) AddGatherer(reg *prometheus.Registry) {
	mg.additional = append(mg.additional, reg)
}

func (mg *multiGatherer) Gather() ([]*dto.MetricFamily, error) {
	results, err := mg.main.Gather()
	if err != nil {
		return nil, err
	}

	if len(mg.additional) == 0 {
		return results, nil
	}

	for _, secondary := range mg.additional {
		gathered, err := secondary.Gather()
		if err != nil {
			return nil, err
		}

		for _, elem := range gathered {
			entry := &dto.MetricFamily{
				Name:   elem.Name,
				Help:   elem.Help,
				Metric: make([]*dto.Metric, 0, len(elem.Metric)),
			}

			if v := elem.Type; v != nil {
				metricType := dto.MetricType(*v)
				entry.Type = &metricType
			}

			for _, metricElem := range elem.Metric {
				metricEntry := &dto.Metric{
					Label:       make([]*dto.LabelPair, 0, len(metricElem.Label)),
					TimestampMs: metricElem.TimestampMs,
				}

				if v := metricElem.Gauge; v != nil {
					metricEntry.Gauge = &dto.Gauge{
						Value: v.Value,
					}
				}

				if v := metricElem.Counter; v != nil {
					metricEntry.Counter = &dto.Counter{
						Value: v.Value,
					}
				}

				if v := metricElem.Summary; v != nil {
					metricEntry.Summary = &dto.Summary{
						SampleCount: v.SampleCount,
						SampleSum:   v.SampleSum,
						Quantile:    make([]*dto.Quantile, 0, len(v.Quantile)),
					}

					for _, quantileElem := range v.Quantile {
						quantileEntry := &dto.Quantile{
							Quantile: quantileElem.Quantile,
							Value:    quantileElem.Value,
						}
						metricEntry.Summary.Quantile = append(metricEntry.Summary.Quantile, quantileEntry)
					}
				}

				if v := metricElem.Untyped; v != nil {
					metricEntry.Untyped = &dto.Untyped{
						Value: v.Value,
					}
				}

				if v := metricElem.Histogram; v != nil {
					metricEntry.Histogram = &dto.Histogram{
						SampleCount: v.SampleCount,
						SampleSum:   v.SampleSum,
						Bucket:      make([]*dto.Bucket, 0, len(v.Bucket)),
					}

					for _, bucketElem := range v.Bucket {
						bucketEntry := &dto.Bucket{
							CumulativeCount: bucketElem.CumulativeCount,
							UpperBound:      bucketElem.UpperBound,
						}
						metricEntry.Histogram.Bucket = append(metricEntry.Histogram.Bucket, bucketEntry)
					}
				}

				for _, labelElem := range metricElem.Label {
					labelEntry := &dto.LabelPair{
						Name:  labelElem.Name,
						Value: labelElem.Value,
					}

					metricEntry.Label = append(metricEntry.Label, labelEntry)
				}

				entry.Metric = append(entry.Metric, metricEntry)
			}

			results = append(results, entry)
		}
	}

	return results, nil
}
