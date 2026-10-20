package dashboard

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache stores JSON-serialisable section data with a TTL.
type Cache interface {
	Get(ctx context.Context, key string, dest any) bool
	Set(ctx context.Context, key string, val any, ttl time.Duration)
}

// MemoryCache is the zero-dependency fallback used when Redis is unavailable.
type MemoryCache struct {
	mu    sync.Mutex
	items map[string]memItem
}

type memItem struct {
	data    []byte
	expires time.Time
}

func NewMemoryCache() *MemoryCache { return &MemoryCache{items: make(map[string]memItem)} }

func (c *MemoryCache) Get(_ context.Context, key string, dest any) bool {
	c.mu.Lock()
	it, ok := c.items[key]
	c.mu.Unlock()
	if !ok || time.Now().After(it.expires) {
		return false
	}
	return json.Unmarshal(it.data, dest) == nil
}

func (c *MemoryCache) Set(_ context.Context, key string, val any, ttl time.Duration) {
	b, err := json.Marshal(val)
	if err != nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.items) > 10000 { // crude bound; entries are short-lived anyway
		c.items = make(map[string]memItem)
	}
	c.items[key] = memItem{data: b, expires: time.Now().Add(ttl)}
}

// RedisCache caches section data in Redis.
type RedisCache struct{ rdb *redis.Client }

func NewRedisCache(rdb *redis.Client) *RedisCache { return &RedisCache{rdb: rdb} }

func (c *RedisCache) Get(ctx context.Context, key string, dest any) bool {
	b, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(b, dest) == nil
}

func (c *RedisCache) Set(ctx context.Context, key string, val any, ttl time.Duration) {
	b, err := json.Marshal(val)
	if err != nil {
		return
	}
	_ = c.rdb.Set(ctx, key, b, ttl).Err()
}
