-- vim: ts=2:sw=2:sts=2:expandtab
luaunit = require('luaunit')
prometheus = require('prometheus')

-- Simple implementation of a nginx shared dictionary
local SimpleDict = {}
SimpleDict.__index = SimpleDict
function SimpleDict:set(k, v)
  if not self.dict then self.dict = {} end
  self.dict[k] = v
  return true, nil, false  -- success, err, forcible
end
function SimpleDict:safe_set(k, v)
  if k:find("willnotfit") then
    return nil, "no memory"
  end
  self:set(k, v)
  return true, nil  -- ok, err
end
function SimpleDict:incr(k, v)
  if not self.dict[k] then return nil, "not found" end
  self.dict[k] = self.dict[k] + v
  return self.dict[k], nil  -- newval, err
end
function SimpleDict:get(k)
  return self.dict[k], 0  -- value, flags
end
function SimpleDict:get_keys(k)
  local keys = {}
  for key in pairs(self.dict) do table.insert(keys, key) end
  return keys
end

-- Global nginx object
local Nginx = {}
Nginx.__index = Nginx
Nginx.ERR = {}
Nginx.WARN = {}
Nginx.header = {}
function Nginx.log(level, ...)
  if not ngx.logs then ngx.logs = {} end
  table.insert(ngx.logs, table.concat({...}, " "))
end
function Nginx.print(printed)
  if not ngx.printed then ngx.printed = {} end
  for str in string.gmatch(table.concat(printed, ""), "([^\n]+)") do
    table.insert(ngx.printed, str)
  end
end

-- Finds index of a given object in a table
local function find_idx(table, element)
  for idx, value in pairs(table) do
    if value == element then
      return idx
    end
  end
end

TestPrometheus = {}
function TestPrometheus:setUp()
  self.dict = setmetatable({}, SimpleDict)
  ngx = setmetatable({shared={metrics=self.dict}}, Nginx)
  self.p = prometheus.init("metrics")
  self.counter1 = self.p:counter("metric1", "Metric 1")
  self.counter2 = self.p:counter("metric2", "Metric 2", {"f2", "f1"})
  self.gauge1 = self.p:gauge("gauge1", "Gauge 1")
  self.gauge2 = self.p:gauge("gauge2", "Gauge 2", {"f2", "f1"})
  self.hist1 = self.p:histogram("l1", "Histogram 1")
  self.hist2 = self.p:histogram("l2", "Histogram 2", {"var", "site"})
end
function TestPrometheus:testInit()
  luaunit.assertEquals(self.dict:get("nginx_metric_errors_total"), 0)
  luaunit.assertEquals(ngx.logs, nil)
end
function TestPrometheus:testErrorUnitialized()
  local p = prometheus
  p:counter("metric1")
  p:histogram("metric2")
  p:gauge("metric3")

  luaunit.assertEquals(#ngx.logs, 3)
end
function TestPrometheus:testErrorNoMemory()
  local counter3 = self.p:counter("willnotfit")
  self.counter1:inc(5)
  counter3:inc(1)

  luaunit.assertEquals(self.dict:get("metric1"), 5)
  luaunit.assertEquals(self.dict:get("nginx_metric_errors_total"), 1)
  luaunit.assertEquals(self.dict:get("willnotfit"), nil)
  luaunit.assertEquals(#ngx.logs, 1)
end
function TestPrometheus:testErrorInvalidMetricName()
  local h = self.p:histogram("name with a space", "Histogram")
  local g = self.p:gauge("nonprintable\004characters", "Gauge")
  local c = self.p:counter("0startswithadigit", "Counter")

  luaunit.assertEquals(self.dict:get("nginx_metric_errors_total"), 3)
  luaunit.assertEquals(#ngx.logs, 3)
end
function TestPrometheus:testErrorInvalidLabels()
  local h = self.p:histogram("hist1", "Histogram", {"le"})
  local g = self.p:gauge("count1", "Gauge", {"le"})
  local c = self.p:counter("count1", "Counter", {"foo\002"})

  luaunit.assertEquals(self.dict:get("nginx_metric_errors_total"), 3)
  luaunit.assertEquals(#ngx.logs, 3)
end
function TestPrometheus:testErrorDuplicateMetrics()
  self.p:counter("metric1", "Another metric 1")
  self.p:counter("l1_count", "Conflicts with Histogram 1")
  self.p:counter("l2_sum", "Conflicts with Histogram 2")
  self.p:counter("l2_bucket", "Conflicts with Histogram 2")
  self.p:gauge("metric1", "Conflicts with Metric 1")
  self.p:histogram("l1", "Conflicts with Histogram 1")
  self.p:histogram("metric2", "Conflicts with Metric 2")

  luaunit.assertEquals(self.dict:get("nginx_metric_errors_total"), 7)
  luaunit.assertEquals(#ngx.logs, 7)
end
function TestPrometheus:testErrorNegativeValue()
  self.counter1:inc(-5)

  luaunit.assertEquals(self.dict:get("metric1"), nil)
  luaunit.assertEquals(self.dict:get("nginx_metric_errors_total"), 1)
  luaunit.assertEquals(#ngx.logs, 1)
end
function TestPrometheus:testErrorIncorrectLabels()
  self.counter1:inc(1, {"should-be-no-labels"})
  self.counter2:inc(1, {"too-few-labels"})
  self.counter2:inc(1)
  self.gauge1:set(1, {"should-be-no-labels"})
  self.gauge2:set(1, {"too-few-labels"})
  self.gauge2:set(1)
  self.hist2:observe(1, {"too", "many", "labels"})
  self.hist2:observe(1, {nil, "label"})
  self.hist2:observe(1, {"label", nil})

  luaunit.assertEquals(self.dict:get("metric1"), nil)
  luaunit.assertEquals(self.dict:get("l1_count"), nil)
  luaunit.assertEquals(self.dict:get("gauge1"), nil)
  luaunit.assertEquals(self.dict:get("gauge2"), nil)
  luaunit.assertEquals(self.dict:get("l1_count"), nil)
  luaunit.assertEquals(self.dict:get("nginx_metric_errors_total"), 9)
  luaunit.assertEquals(#ngx.logs, 9)
end
function TestPrometheus:testNumericLabelValues()
  self.counter2:inc(1, {0, 15.5})
  self.gauge2:set(1, {0, 15.5})
  self.hist2:observe(1, {-3, 90000})

  luaunit.assertEquals(self.dict:get('metric2{f2="0",f1="15.5"}'), 1)
  luaunit.assertEquals(self.dict:get('gauge2{f2="0",f1="15.5"}'), 1)
  luaunit.assertEquals(self.dict:get('l2_sum{var="-3",site="90000"}'), 1)
  luaunit.assertEquals(ngx.logs, nil)
end
function TestPrometheus:testNonPrintableLabelValues()
  self.counter2:inc(1, {"foo", "baz\189\166qux"})
  self.gauge2:set(1, {"z\001", "\002"})
  self.hist2:observe(1, {"\166omg", "fooшbar"})

  luaunit.assertEquals(self.dict:get('metric2{f2="foo",f1="bazqux"}'), 1)
  luaunit.assertEquals(self.dict:get('gauge2{f2="z",f1=""}'), 1)
  luaunit.assertEquals(self.dict:get('l2_sum{var="omg",site="foobar"}'), 1)
  luaunit.assertEquals(ngx.logs, nil)
end
function TestPrometheus:testNoValues()
  self.counter1:inc()  -- defaults to 1
  self.gauge1:set()  -- should produce an error
  self.hist1:observe()  -- should produce an error

  luaunit.assertEquals(self.dict:get("metric1"), 1)
  luaunit.assertEquals(self.dict:get("nginx_metric_errors_total"), 2)
  luaunit.assertEquals(#ngx.logs, 2)
end
function TestPrometheus:testCounters()
  self.counter1:inc()
  self.counter1:inc(4)
  self.counter2:inc(1, {"v2", "v1"})
  self.counter2:inc(3, {"v2", "v1"})

  luaunit.assertEquals(self.dict:get("metric1"), 5)
  luaunit.assertEquals(self.dict:get('metric2{f2="v2",f1="v1"}'), 4)
  luaunit.assertEquals(ngx.logs, nil)
end
function TestPrometheus:testLatencyHistogram()
  self.hist1:observe(0.35)
  self.hist1:observe(0.4)
  self.hist2:observe(0.001, {"ok", "site1"})
  self.hist2:observe(0.15, {"ok", "site1"})

  luaunit.assertEquals(self.dict:get('l1_bucket{le="00.300"}'), nil)
  luaunit.assertEquals(self.dict:get('l1_bucket{le="00.400"}'), 2)
  luaunit.assertEquals(self.dict:get('l1_bucket{le="00.500"}'), 2)
  luaunit.assertEquals(self.dict:get('l1_bucket{le="Inf"}'), 2)
  luaunit.assertEquals(self.dict:get('l1_count'), 2)
  luaunit.assertEquals(self.dict:get('l1_sum'), 0.75)
  luaunit.assertEquals(self.dict:get('l2_bucket{var="ok",site="site1",le="00.005"}'), 1)
  luaunit.assertEquals(self.dict:get('l2_bucket{var="ok",site="site1",le="00.100"}'), 1)
  luaunit.assertEquals(self.dict:get('l2_bucket{var="ok",site="site1",le="00.200"}'), 2)
  luaunit.assertEquals(self.dict:get('l2_bucket{var="ok",site="site1",le="Inf"}'), 2)
  luaunit.assertEquals(self.dict:get('l2_count{var="ok",site="site1"}'), 2)
  luaunit.assertEquals(self.dict:get('l2_sum{var="ok",site="site1"}'), 0.151)
  luaunit.assertEquals(ngx.logs, nil)
end
function TestPrometheus:testLabelEscaping()
  self.counter2:inc(1, {"v2", "\""})
  self.counter2:inc(5, {"v2", "\\"})
  self.gauge2:set(1, {"v2", "\""})
  self.gauge2:set(5, {"v2", "\\"})
  self.hist2:observe(0.001, {"ok", "site\"1"})
  self.hist2:observe(0.15, {"ok", "site\"1"})

  luaunit.assertEquals(self.dict:get('metric2{f2="v2",f1="\\""}'), 1)
  luaunit.assertEquals(self.dict:get('metric2{f2="v2",f1="\\\\"}'), 5)
  luaunit.assertEquals(self.dict:get('gauge2{f2="v2",f1="\\""}'), 1)
  luaunit.assertEquals(self.dict:get('gauge2{f2="v2",f1="\\\\"}'), 5)
  luaunit.assertEquals(self.dict:get('l2_bucket{var="ok",site="site\\"1",le="00.005"}'), 1)
  luaunit.assertEquals(self.dict:get('l2_bucket{var="ok",site="site\\"1",le="00.100"}'), 1)
  luaunit.assertEquals(self.dict:get('l2_bucket{var="ok",site="site\\"1",le="00.200"}'), 2)
  luaunit.assertEquals(self.dict:get('l2_bucket{var="ok",site="site\\"1",le="Inf"}'), 2)
  luaunit.assertEquals(self.dict:get('l2_count{var="ok",site="site\\"1"}'), 2)
  luaunit.assertEquals(self.dict:get('l2_sum{var="ok",site="site\\"1"}'), 0.151)
  luaunit.assertEquals(ngx.logs, nil)
end
function TestPrometheus:testCustomBucketer1()
  local hist3 = self.p:histogram("l3", "Histogram 3", {"var"}, {1,2,3})
  self.hist1:observe(0.35)
  hist3:observe(2, {"ok"})
  hist3:observe(0.151, {"ok"})

  luaunit.assertEquals(self.dict:get('l1_bucket{le="00.300"}'), nil)
  luaunit.assertEquals(self.dict:get('l1_bucket{le="00.400"}'), 1)
  luaunit.assertEquals(self.dict:get('l3_bucket{var="ok",le="1.0"}'), 1)
  luaunit.assertEquals(self.dict:get('l3_bucket{var="ok",le="2.0"}'), 2)
  luaunit.assertEquals(self.dict:get('l3_bucket{var="ok",le="3.0"}'), 2)
  luaunit.assertEquals(self.dict:get('l3_bucket{var="ok",le="Inf"}'), 2)
  luaunit.assertEquals(self.dict:get('l3_count{var="ok"}'), 2)
  luaunit.assertEquals(self.dict:get('l3_sum{var="ok"}'), 2.151)
  luaunit.assertEquals(ngx.logs, nil)
end
function TestPrometheus:testCustomBucketer2()
  local hist3 = self.p:histogram("l3", "Histogram 3", {"var"},
    {0.000005,5,50000})
  hist3:observe(0.000001, {"ok"})
  hist3:observe(3, {"ok"})
  hist3:observe(7, {"ok"})
  hist3:observe(70000, {"ok"})

  luaunit.assertEquals(self.dict:get('l3_bucket{var="ok",le="00000.000005"}'), 1)
  luaunit.assertEquals(self.dict:get('l3_bucket{var="ok",le="00005.000000"}'), 2)
  luaunit.assertEquals(self.dict:get('l3_bucket{var="ok",le="50000.000000"}'), 3)
  luaunit.assertEquals(self.dict:get('l3_bucket{var="ok",le="Inf"}'), 4)
  luaunit.assertEquals(self.dict:get('l3_count{var="ok"}'), 4)
  luaunit.assertEquals(self.dict:get('l3_sum{var="ok"}'), 70010.000001)
  luaunit.assertEquals(ngx.logs, nil)
end
function TestPrometheus:testCollect()
  local hist3 = self.p:histogram("b1", "Bytes", {"var"}, {100, 2000})
  self.counter1:inc(5)
  self.counter2:inc(2, {"v2", "v1"})
  self.counter2:inc(2, {"v2", "v1"})
  self.gauge1:set(3)
  self.gauge2:set(2, {"v2", "v1"})
  self.gauge2:set(5, {"v2", "v1"})
  self.hist1:observe(0.000001)
  self.hist2:observe(0.000001, {"ok", "site2"})
  self.hist2:observe(3, {"ok", "site2"})
  self.hist2:observe(7, {"ok", "site2"})
  self.hist2:observe(70000, {"ok","site2"})
  hist3:observe(50, {"ok"})
  hist3:observe(50, {"ok"})
  hist3:observe(150, {"ok"})
  hist3:observe(5000, {"ok"})
  self.p:collect()

  assert(find_idx(ngx.printed, "# HELP metric1 Metric 1") ~= nil)
  assert(find_idx(ngx.printed, "# TYPE metric1 counter") ~= nil)
  assert(find_idx(ngx.printed, "metric1 5") ~= nil)

  assert(find_idx(ngx.printed, "# TYPE metric2 counter") ~= nil)
  assert(find_idx(ngx.printed, 'metric2{f2="v2",f1="v1"} 4') ~= nil)

  assert(find_idx(ngx.printed, "# TYPE gauge1 gauge") ~= nil)
  assert(find_idx(ngx.printed, 'gauge1 3') ~= nil)

  assert(find_idx(ngx.printed, "# TYPE gauge2 gauge") ~= nil)
  assert(find_idx(ngx.printed, 'gauge2{f2="v2",f1="v1"} 5') ~= nil)

  assert(find_idx(ngx.printed, "# TYPE b1 histogram") ~= nil)
  assert(find_idx(ngx.printed, "# HELP b1 Bytes") ~= nil)
  assert(find_idx(ngx.printed, 'b1_bucket{var="ok",le="0100.0"} 2') ~= nil)
  assert(find_idx(ngx.printed, 'b1_sum{var="ok"} 5250') ~= nil)

  assert(find_idx(ngx.printed, 'l2_bucket{var="ok",site="site2",le="04.000"} 2') ~= nil)
  assert(find_idx(ngx.printed, 'l2_bucket{var="ok",site="site2",le="+Inf"} 4') ~= nil)

  -- check that type comment exists and is before any samples for the metric.
  local type_idx = find_idx(ngx.printed, '# TYPE l1 histogram')
  assert (type_idx ~= nil)
  assert (ngx.printed[type_idx-1]:find("^l1") == nil)
  assert (ngx.printed[type_idx+1]:find("^l1") ~= nil)
  luaunit.assertEquals(ngx.logs, nil)
end

function TestPrometheus:testCollectWithPrefix()
  local p = prometheus.init("metrics", "test_pref_")
  local counter1 = p:counter("metric1", "Metric 1")
  local gauge1 = p:gauge("gauge1", "Gauge 1")
  local hist1 = p:histogram("b1", "Bytes", {"var"}, {100, 2000})
  counter1:inc(5)
  gauge1:set(3)
  hist1:observe(50, {"ok"})
  hist1:observe(50, {"ok"})
  hist1:observe(150, {"ok"})
  hist1:observe(5000, {"ok"})
  p:collect()

  assert(find_idx(ngx.printed, "# HELP test_pref_metric1 Metric 1") ~= nil)
  assert(find_idx(ngx.printed, "# TYPE test_pref_metric1 counter") ~= nil)
  assert(find_idx(ngx.printed, "test_pref_metric1 5") ~= nil)

  assert(find_idx(ngx.printed, "# HELP test_pref_gauge1 Gauge 1") ~= nil)
  assert(find_idx(ngx.printed, "# TYPE test_pref_gauge1 gauge") ~= nil)
  assert(find_idx(ngx.printed, "test_pref_gauge1 3") ~= nil)

  assert(find_idx(ngx.printed, "# TYPE test_pref_b1 histogram") ~= nil)
  assert(find_idx(ngx.printed, "# HELP test_pref_b1 Bytes") ~= nil)
  assert(find_idx(ngx.printed, 'test_pref_b1_bucket{var="ok",le="0100.0"} 2') ~= nil)
  assert(find_idx(ngx.printed, 'test_pref_b1_sum{var="ok"} 5250') ~= nil)
end

os.exit(luaunit.run())
