-- KEYS[1] = driver:{id}:status
-- ARGV[1] = expected current driver status
-- ARGV[2] = new status of driver

local current = redis.call("GET" , KEYS[1])

if current == ARGV[1] then
    redis.call("SET" , KEYS[1] , ARGV[2])
    return 1
else
    return 0
end
