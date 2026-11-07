package fingerprint

import (
	"net"
	"strings"
	"sync"

	"go.uber.org/zap"
)

type Engine struct {
	logger *zap.Logger
	vendors map[string]string
	mu      sync.RWMutex
}

type Fingerprint struct {
	OS            string            `json:"os"`
	DeviceType    string            `json:"device_type"`
	Vendor        string            `json:"vendor"`
	Services      map[int]string    `json:"services"`
	Confidence    float64           `json:"confidence"`
	Metadata      map[string]string `json:"metadata"`
}

func NewEngine(logger *zap.Logger) *Engine {
	e := &Engine{
		logger:  logger,
		vendors: make(map[string]string),
	}
	e.loadOUIDatabase()
	return e
}

func (e *Engine) loadOUIDatabase() {
	// Load OUI database (first 3 bytes of MAC)
	// In production, load from IEEE OUI database
	e.vendors["00:00:00"] = "Xerox"
	e.vendors["00:00:01"] = "Xerox"
	e.vendors["00:00:02"] = "Xerox"
	e.vendors["00:00:03"] = "Xerox"
	e.vendors["00:00:04"] = "Xerox"
	e.vendors["00:00:05"] = "Xerox"
	e.vendors["00:00:06"] = "Xerox"
	e.vendors["00:00:07"] = "Xerox"
	e.vendors["00:00:08"] = "Xerox"
	e.vendors["00:00:09"] = "Xerox"
	// ... more OUIs would be loaded from file
}

func (e *Engine) LookupVendor(mac string) string {
	if mac == "" {
		return ""
	}
	// Normalize MAC
	mac = strings.ToUpper(mac)
	mac = strings.ReplaceAll(mac, "-", ":")
	parts := strings.Split(mac, ":")
	if len(parts) < 3 {
		return ""
	}
	oui := strings.Join(parts[:3], ":")
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.vendors[oui]
}

func (e *Engine) FingerprintDevice(ip string, mac string, ports []int, hostnames []string) *Fingerprint {
	fp := &Fingerprint{
		OS:         "unknown",
		DeviceType: "unknown",
		Vendor:     e.LookupVendor(mac),
		Services:   make(map[int]string),
		Confidence: 0.5,
		Metadata:   make(map[string]string),
	}

	// Identify services from open ports
	for _, port := range ports {
		if service := e.identifyService(port); service != "" {
			fp.Services[port] = service
		}
	}

	// OS fingerprinting based on port combinations
	fp.OS = e.fingerprintOS(ports)
	fp.DeviceType = e.classifyDevice(fp.Vendor, fp.Services, hostnames)

	// Adjust confidence
	if fp.Vendor != "" {
		fp.Confidence += 0.2
	}
	if len(fp.Services) > 0 {
		fp.Confidence += 0.1
	}
	if fp.OS != "unknown" {
		fp.Confidence += 0.1
	}
	if fp.Confidence > 1.0 {
		fp.Confidence = 1.0
	}

	return fp
}

func (e *Engine) identifyService(port int) string {
	services := map[int]string{
		21:    "ftp",
		22:    "ssh",
		23:    "telnet",
		25:    "smtp",
		53:    "dns",
		67:    "dhcp",
		68:    "dhcp",
		69:    "tftp",
		80:    "http",
		110:   "pop3",
		111:   "rpcbind",
		135:   "msrpc",
		139:   "netbios",
		143:   "imap",
		161:   "snmp",
		162:   "snmp-trap",
		389:   "ldap",
		443:   "https",
		445:   "smb",
		465:   "smtps",
		514:   "syslog",
		515:   "lpd",
		587:   "submission",
		631:   "ipp",
		636:   "ldaps",
		993:   "imaps",
		995:   "pop3s",
		1024:  "kdm",
		1025:  "msrpc",
		1433:  "mssql",
		1521:  "oracle",
		2049:  "nfs",
		2375:  "docker",
		2376:  "docker-tls",
		3306:  "mysql",
		3389:  "rdp",
		5432:  "postgresql",
		5900:  "vnc",
		5985:  "winrm",
		5986:  "winrm-ssl",
		6379:  "redis",
		8006:  "proxmox",
		8080:  "http-alt",
		8443:  "https-alt",
		9000:  "sonarqube",
		9090:  "prometheus",
		9200:  "elasticsearch",
		11211: "memcached",
		27017: "mongodb",
	}

	if service, ok := services[port]; ok {
		return service
	}
	return "unknown"
}

func (e *Engine) fingerprintOS(ports []int) string {
	portSet := make(map[int]bool)
	for _, p := range ports {
		portSet[p] = true
	}

	// Windows indicators
	if portSet[135] && portSet[139] && portSet[445] {
		return "windows"
	}
	if portSet[3389] || portSet[5985] || portSet[5986] {
		return "windows"
	}

	// Linux/Unix indicators
	if portSet[22] && !portSet[135] && !portSet[445] {
		return "linux"
	}

	// Network device
	if portSet[23] || portSet[161] || portSet[22] && portSet[80] && portSet[443] {
		if portSet[22] && (portSet[80] || portSet[443]) && !portSet[445] {
			return "network"
		}
	}

	// macOS
	if portSet[548] || portSet[631] || portSet[5353] {
		return "macos"
	}

	return "unknown"
}

func (e *Engine) classifyDevice(vendor string, services map[int]string, hostnames []string) string {
	vendorLower := strings.ToLower(vendor)

	// By vendor
	if strings.Contains(vendorLower, "apple") {
		return "apple"
	}
	if strings.Contains(vendorLower, "microsoft") || strings.Contains(vendorLower, "xbox") {
		return "windows"
	}
	if strings.Contains(vendorLower, "cisco") || strings.Contains(vendorLower, "juniper") ||
	   strings.Contains(vendorLower, "aruba") || strings.Contains(vendorLower, "ubiquiti") ||
	   strings.Contains(vendorLower, "mikrotik") || strings.Contains(vendorLower, "fortinet") ||
	   strings.Contains(vendorLower, "palo alto") || strings.Contains(vendorLower, "check point") {
		return "network"
	}
	if strings.Contains(vendorLower, "vmware") || strings.Contains(vendorLower, "virtualbox") ||
	   strings.Contains(vendorLower, "qemu") || strings.Contains(vendorLower, "parallels") {
		return "vm"
	}
	if strings.Contains(vendorLower, "raspberry") || strings.Contains(vendorLower, "arduino") ||
	   strings.Contains(vendorLower, "espressif") || strings.Contains(vendorLower, "particle") {
		return "iot"
	}
	if strings.Contains(vendorLower, "hikvision") || strings.Contains(vendorLower, "dahua") ||
	   strings.Contains(vendorLower, "axis") || strings.Contains(vendorLower, "hanwha") ||
	   strings.Contains(vendorLower, "bosch") || strings.Contains(vendorLower, "sony") {
		return "camera"
	}
	if strings.Contains(vendorLower, "hp") || strings.Contains(vendorLower, "canon") ||
	   strings.Contains(vendorLower, "epson") || strings.Contains(vendorLower, "brother") ||
	   strings.Contains(vendorLower, "lexmark") || strings.Contains(vendorLower, "xerox") ||
	   strings.Contains(vendorLower, "ricoh") || strings.Contains(vendorLower, "kyocera") {
		return "printer"
	}
	if strings.Contains(vendorLower, "synology") || strings.Contains(vendorLower, "qnap") ||
	   strings.Contains(vendorLower, "dell") || strings.Contains(vendorLower, "hpe") ||
	   strings.Contains(vendorLower, "lenovo") || strings.Contains(vendorLower, "supermicro") {
		return "nas"
	}

	// By services
	if services[3389] != "" || services[5985] != "" || services[5986] != "" {
		return "server"
	}
	if services[22] != "" && (services[80] != "" || services[443] != "" || services[8080] != "") {
		return "web-server"
	}
	if services[139] != "" || services[445] != "" {
		return "windows"
	}
	if services[548] != "" || services[631] != "" || services[5353] != "" {
		return "apple"
	}
	if services[161] != "" || services[23] != "" {
		return "network"
	}

	// By hostname
	for _, hostname := range hostnames {
		hn := strings.ToLower(hostname)
		if strings.Contains(hn, "printer") || strings.Contains(hn, "print") {
			return "printer"
		}
		if strings.Contains(hn, "camera") || strings.Contains(hn, "cam-") || strings.Contains(hn, "ipcam") {
			return "camera"
		}
		if strings.Contains(hn, "nas-") || strings.Contains(hn, "storage") {
			return "nas"
		}
		if strings.Contains(hn, "router") || strings.Contains(hn, "gateway") || strings.Contains(hn, "fw-") {
			return "network"
		}
		if strings.Contains(hn, "vm-") || strings.Contains(hn, "virtual") {
			return "vm"
		}
		if strings.Contains(hn, "iot-") || strings.Contains(hn, "sensor") || strings.Contains(hn, "switch") {
			return "iot"
		}
	}

	return "unknown"
}