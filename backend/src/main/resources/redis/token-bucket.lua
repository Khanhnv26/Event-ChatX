local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local states = {}
local retry = 0

for i, key in ipairs(KEYS) do
    local capacity = tonumber(ARGV[(i - 1) * 2 + 1])
    local rate = tonumber(ARGV[(i - 1) * 2 + 2]) / 1000
    local stored = redis.call('HMGET', key, 'tokens', 'updated')
    local tokens = tonumber(stored[1]) or capacity
    local updated = tonumber(stored[2]) or now
    local elapsed = math.max(0, now - updated)
    tokens = math.min(capacity, tokens + elapsed * rate)
    states[i] = {tokens, math.max(updated, now), math.max(1, math.ceil(capacity / rate))}
    if tokens < 1 then
        retry = math.max(retry, math.ceil((1 - tokens) / rate))
    end
end

if retry > 0 then return {0, retry} end

for i, key in ipairs(KEYS) do
    redis.call('HSET', key, 'tokens', states[i][1] - 1, 'updated', states[i][2])
    redis.call('PEXPIRE', key, states[i][3])
end
return {1, 0}

