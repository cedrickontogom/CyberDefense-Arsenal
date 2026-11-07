package scanner

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
	"go.uber.org/zap"
)

type Config struct {
	Workers     int
	RedisURL    string
	KafkaBrokers string
}

type Engine struct {
	logger   *zap.Logger
	config   Config
	redis    *redis.Client
	kafka    *kafka.Writer
	scans    sync.Map // map[string]*Scan
	wg       sync.WaitGroup
	ctx      context.Context
	cancel   context.CancelFunc
}

type Scan struct {
	ID          string                 `json:"id"`
	Interface   string                 `json:"interface"`
	CIDR        string                 `json:"cidr"`
	Ports       []int                  `json:"ports"`
	Status      string                 `json:"status"` // running, completed, failed
	Progress    float64                `json:"progress"`
	Devices     []Device               `json:"devices"`
	StartedAt   time.Time              `json:"started_at"`
	CompletedAt *time.Time             `json:"completed_at,omitempty"`
	Error       string                 `json:"error,omitempty"`
	Options     map[string]interface{} `json:"options"`
}

type Device struct {
	IP            string            `json:"ip"`
	MAC           string            `json:"mac"`
	Vendor        string            `json:"vendor"`
	Hostnames     []string          `json:"hostnames"`
	Ports         []Port            `json:"ports"`
	OS            string            `json:"os,omitempty"`
	DeviceType    string            `json:"device_type,omitempty"`
	FirstSeen     time.Time         `json:"first_seen"`
	LastSeen      time.Time         `json:"last_seen"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type Port struct {
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
	State    string `json:"state"`
	Service  string `json:"service,omitempty"`
	Banner   string `json:"banner,omitempty"`
}

func NewEngine(logger *zap.Logger, config Config) *Engine {
	ctx, cancel := context.WithCancel(context.Background())

	// Initialize Redis
	opt, _ := redis.ParseURL(config.RedisURL)
	redisClient := redis.NewClient(opt)

	// Initialize Kafka writer
	kafkaWriter := &kafka.Writer{
		Addr:     kafka.TCP(config.KafkaBrokers),
		Topic:    "network-scans",
		Balancer: &kafka.LeastBytes{},
	}

	return &Engine{
		logger:   logger,
		config:   config,
		redis:    redisClient,
		kafka:    kafkaWriter,
		ctx:      ctx,
		cancel:   cancel,
	}
}

func (e *Engine) StartScan(scan *Scan) error {
	e.logger.Info("Starting scan", zap.String("scan_id", scan.ID), zap.String("cidr", scan.CIDR))

	// Store scan
	e.scans.Store(scan.ID, scan)

	// Publish scan started event
	e.publishEvent("scan_started", map[string]interface{}{
		"scan_id": scan.ID,
		"cidr":    scan.CIDR,
	})

	// Start scan in background
	e.wg.Add(1)
	go e.runScan(scan)

	return nil
}

func (e *Engine) runScan(scan *Scan) {
	defer e.wg.Done()

	// Parse CIDR
	_, ipNet, err := net.ParseCIDR(scan.CIDR)
	if err != nil:
		scan.Status = "failed"
		scan.Error = fmt.Sprintf("Invalid CIDR: %v", err)
		e.publishEvent("scan_failed", map[string]interface{}{
			"scan_id": scan.ID,
			"error":   scan.Error,
		})
		return
	}

	// Generate IP list
	ips := e.generateIPs(ipNet)
	totalIPs := len(ips)
	scan.Status = "running"

	// Create worker pool
	jobs := make(chan string, totalIPs)
	results := make(chan *Device, totalIPs)

	// Start workers
	for i := 0; i < e.config.Workers; i++ {
		e.wg.Add(1)
		go e.scanWorker(scan.ID, jobs, results)
	}

	// Send jobs
	go func() {
		for _, ip := range ips {
			select {
			case jobs <- ip:
			case <-e.ctx.Done():
				close(jobs)
				return
			}
		}
		close(jobs)
	}()

	// Collect results
	completed := 0
	for device := range results {
		if device != nil {
			scan.Devices = append(scan.Devices, *device)
		}
		completed++
		scan.Progress = float64(completed) / float64(totalIPs) * 100

		// Publish progress
		if completed%10 == 0 || completed == totalIPs {
			e.publishEvent("scan_progress", map[string]interface{}{
				"scan_id":  scan.ID,
				"progress": scan.Progress,
				"found":    len(scan.Devices),
			})
		}
	}

	// Wait for workers
	e.wg.Wait()

	// Mark completed
	now := time.Now()
	scan.CompletedAt = &now
	scan.Status = "completed"
	scan.Progress = 100

	e.publishEvent("scan_completed", map[string]interface{}{
		"scan_id":      scan.ID,
		"devices_found": len(scan.Devices),
		"duration":     now.Sub(scan.StartedAt).Seconds(),
	})

	e.logger.Info("Scan completed", zap.String("scan_id", scan.ID), zap.Int("devices", len(scan.Devices)))
}

func (e *Engine) scanWorker(scanID string, jobs <-chan string, results chan<- *Device) {
	defer e.wg.Done()

	scanVal, ok := e.scans.Load(scanID)
	if !ok {
		return
	}
	scan := scanVal.(*Scan)

	for ip := range jobs {
		select {
		case <-e.ctx.Done():
			return
		default:
		}

		device := e.scanIP(ip, scan.Ports)
		if device != nil {
			results <- device
		} else {
			results <- nil
		}
	}
}

func (e *Engine) scanIP(ip string, ports []int) *Device {
	// ARP scan for local network
	mac, vendor := e.arpScan(ip)
	if mac == "" {
		// Try ICMP ping
		if !e.pingScan(ip) {
			return nil
		}
	}

	device := &Device{
		IP:        ip,
		MAC:       mac,
		Vendor:    vendor,
		Hostnames: []string{},
		Ports:     []Port{},
		FirstSeen: time.Now(),
		LastSeen:  time.Now(),
		Metadata:  make(map[string]string),
	}

	// Port scan
	for _, port := range ports {
		if e.tcpScan(ip, port) {
			device.Ports = append(device.Ports, Port{
				Port:     port,
				Protocol: "tcp",
				State:    "open",
			})
		}
	}

	// Resolve hostnames (will be enhanced by resolver engine)
	device.Hostnames = e.resolveHostnames(ip)

	// Detect device type
	device.DeviceType = e.detectDeviceType(device)

	return device
}

func (e *Engine) generateIPs(ipNet *net.IPNet) []string {
	var ips []string
	for ip := ipNet.IP.Mask(ipNet.Mask); ipNet.Contains(ip); e.incIP(ip) {
		// Skip network and broadcast addresses
		if ip.Equal(ipNet.IP) || ip.Equal(e.broadcastIP(ipNet)) {
			continue
		}
		ips = append(ips, ip.String())
	}
	return ips
}

func (e *Engine) incIP(ip net.IP) {
	for j := len(ip) - 1; j >= 0; j-- {
		ip[j]++
		if ip[j] > 0 {
			break
		}
	}
}

func (e *Engine) broadcastIP(ipNet *net.IPNet) net.IP {
	broadcast := make(net.IP, len(ipNet.IP))
	copy(broadcast, ipNet.IP)
	for i := range broadcast {
		broadcast[i] |= ^ipNet.Mask[i]
	}
	return broadcast
}

func (e *Engine) arpScan(ip string) (string, string) {
	// Simplified ARP scan - in production use gopacket for raw ARP
	// This is a placeholder
	return "", ""
}

func (e *Engine) pingScan(ip string) bool {
	// ICMP ping
	conn, err := net.DialTimeout("ip4:icmp", ip, 2*time.Second)
	if err != nil {
		return false
	}
	defer conn.Close()
	return true
}

func (e *Engine) tcpScan(ip string, port int) bool {
	address := fmt.Sprintf("%s:%d", ip, port)
	conn, err := net.DialTimeout("tcp", address, 2*time.Second)
	if err != nil {
		return false
	}
	defer conn.Close()
	return true
}

func (e *Engine) resolveHostnames(ip string) []string {
	names, _ := net.LookupAddr(ip)
	return names
}

func (e *Engine) detectDeviceType(device *Device) string {
	// Simple device type detection based on MAC vendor and open ports
	if device.Vendor != "" {
		vendorLower := device.Vendor
		if contains(vendorLower, "apple") {
			return "apple"
		}
		if contains(vendorLower, "microsoft") || contains(vendorLower, "windows") {
			return "windows"
		}
		if contains(vendorLower, "linux") || contains(vendorLower, "ubuntu") || contains(vendorLower, "debian") {
			return "linux"
		}
		if contains(vendorLower, "cisco") || contains(vendorLower, "juniper") || contains(vendorLower, "aruba") {
			return "network"
		}
		if contains(vendorLower, "vmware") || contains(vendorLower, "virtualbox") || contains(vendorLower, "qemu") {
			return "vm"
		}
		if contains(vendorLower, "raspberry") {
			return "iot"
		}
		if contains(vendorLower, "hikvision") || contains(vendorLower, "dahua") || contains(vendorLower, "axis") {
			return "camera"
		}
		if contains(vendorLower, "hp") || contains(vendorLower, "canon") || contains(vendorLower, "epson") || contains(vendorLower, "brother") {
			return "printer"
		}
	}

	// Check ports
	for _, port := range device.Ports {
		if port.Port == 22 || port.Port == 3389 || port.Port == 5900 {
			return "server"
		}
		if port.Port == 80 || port.Port == 443 || port.Port == 8080 {
			return "web"
		}
		if port.Port == 139 || port.Port == 445 {
			return "windows"
		}
		if port.Port == 5353 { // mDNS
			return "apple"
		}
	}

	return "unknown"
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || indexSubstring(s, substr) >= 0))
}

func indexSubstring(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func (e *Engine) GetScan(id string) (*Scan, bool) {
	val, ok := e.scans.Load(id)
	if !ok {
		return nil, false
	}
	return val.(*Scan), true
}

func (e *Engine) ListScans() []*Scan {
	var scans []*Scan
	e.scans.Range(func(key, value interface{}) bool {
		scans = append(scans, value.(*Scan))
		return true
	})
	return scans
}

func (e *Engine) publishEvent(eventType string, data map[string]interface{}) {
	data["event_type"] = eventType
	data["timestamp"] = time.Now().Unix()

	jsonData, _ := json.Marshal(data)
	e.kafka.WriteMessages(e.ctx, kafka.Message{
		Key:   []byte(eventType),
		Value: jsonData,
	})
}

func (e *Engine) Close() {
	e.cancel()
	e.wg.Wait()
	e.redis.Close()
	e.kafka.Close()
}