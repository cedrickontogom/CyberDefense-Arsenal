package resolver

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/miekg/dns"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Config struct {
	RedisURL string
}

type Engine struct {
	logger   *zap.Logger
	config   Config
	redis    *redis.Client
	cache    sync.Map
	ctx      context.Context
	cancel   context.CancelFunc
}

type HostnameResult struct {
	IP         string   `json:"ip"`
	Hostnames  []string `json:"hostnames"`
	Sources    []string `json:"sources"`
	ResolvedAt time.Time `json:"resolved_at"`
}

func NewEngine(logger *zap.Logger, config Config) *Engine {
	ctx, cancel := context.WithCancel(context.Background())

	opt, _ := redis.ParseURL(config.RedisURL)
	redisClient := redis.NewClient(opt)

	return &Engine{
		logger:   logger,
		config:   config,
		redis:    redisClient,
		ctx:      ctx,
		cancel:   cancel,
	}
}

func (e *Engine) Resolve(ip string) (*HostnameResult, error) {
	// Check cache first
	if cached, ok := e.cache.Load(ip); ok {
		return cached.(*HostnameResult), nil
	}

	result := &HostnameResult{
		IP:        ip,
		Hostnames: []string{},
		Sources:   []string{},
		ResolvedAt: time.Now(),
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	// DNS Reverse Lookup
	wg.Add(1)
	go func() {
		defer wg.Done()
		names, err := net.LookupAddr(ip)
		if err == nil && len(names) > 0 {
			mu.Lock()
			result.Hostnames = append(result.Hostnames, names...)
			result.Sources = append(result.Sources, "dns")
			mu.Unlock()
		}
	}()

	// mDNS/Bonjour
	wg.Add(1)
	go func() {
		defer wg.Done()
		names := e.mdnsQuery(ip)
		if len(names) > 0 {
			mu.Lock()
			result.Hostnames = append(result.Hostnames, names...)
			result.Sources = append(result.Sources, "mdns")
			mu.Unlock()
		}
	}()

	// NetBIOS
	wg.Add(1)
	go func() {
		defer wg.Done()
		names := e.netbiosQuery(ip)
		if len(names) > 0 {
			mu.Lock()
			result.Hostnames = append(result.Hostnames, names...)
			result.Sources = append(result.Sources, "netbios")
			mu.Unlock()
		}
	}()

	// SMB
	wg.Add(1)
	go func() {
		defer wg.Done()
		names := e.smbQuery(ip)
		if len(names) > 0 {
			mu.Lock()
			result.Hostnames = append(result.Hostnames, names...)
			result.Sources = append(result.Sources, "smb")
			mu.Unlock()
		}
	}()

	// RDP Certificate
	wg.Add(1)
	go func() {
		defer wg.Done()
		names := e.rdpCertificateQuery(ip)
		if len(names) > 0 {
			mu.Lock()
			result.Hostnames = append(result.Hostnames, names...)
			result.Sources = append(result.Sources, "rdp")
			mu.Unlock()
		}
	}()

	wg.Wait()

	// Deduplicate
	result.Hostnames = deduplicate(result.Hostnames)

	// Cache result
	e.cache.Store(ip, result)

	// Store in Redis for persistence
	e.storeInRedis(result)

	return result, nil
}

func (e *Engine) mdnsQuery(ip string) []string {
	// mDNS query for .local names
	// This is a simplified implementation
	return []string{}
}

func (e *Engine) netbiosQuery(ip string) []string {
	// NetBIOS name query (port 137)
	return []string{}
}

func (e *Engine) smbQuery(ip string) []string {
	// SMB hostname discovery (port 445)
	return []string{}
}

func (e *Engine) rdpCertificateQuery(ip string) []string {
	// RDP certificate hostname extraction (port 3389)
	return []string{}
}

func (e *Engine) storeInRedis(result *HostnameResult) {
	key := fmt.Sprintf("hostname:%s", result.IP)
	data, _ := json.Marshal(result)
	e.redis.Set(e.ctx, key, data, 24*time.Hour)
}

func (e *Engine) Close() {
	e.cancel()
	e.redis.Close()
}

func deduplicate(slice []string) []string {
	seen := make(map[string]bool)
	result := []string{}
	for _, item := range slice {
		item = strings.TrimSpace(strings.TrimSuffix(item, "."))
		if item != "" && !seen[item] {
			seen[item] = true
			result = append(result, item)
		}
	}
	return result
}