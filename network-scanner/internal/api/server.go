package api

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"cyberdefense-arsenal/network-scanner/internal/scanner"
	"cyberdefense-arsenal/network-scanner/internal/resolver"
	"cyberdefense-arsenal/network-scanner/internal/fingerprint"
)

//go:embed webui/dist/*
var webUIFS embed.FS

type Config struct {
	Port             int
	WebUIPort        int
	ScanEngine       *scanner.Engine
	ResolverEngine   *resolver.Engine
	FingerprintEngine *fingerprint.Engine
}

type Server struct {
	logger           *zap.Logger
	config           Config
	apiServer        *http.Server
	webUIServer      *http.Server
	upgrader         websocket.Upgrader
	scanEngine       *scanner.Engine
	resolverEngine   *resolver.Engine
	fingerprintEngine *fingerprint.Engine
	wsClients        map[*websocket.Conn]bool
	wsMutex          sync.Mutex
}

type WebSocketMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

func NewServer(logger *zap.Logger, config Config) *Server {
	return &Server{
		logger:            logger,
		config:            config,
		scanEngine:        config.ScanEngine,
		resolverEngine:    config.ResolverEngine,
		fingerprintEngine: config.FingerprintEngine,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		wsClients: make(map[*websocket.Conn]bool),
	}
}

func (s *Server) Start(ctx context.Context) error {
	// API Server
	gin.SetMode(gin.ReleaseMode)
	apiRouter := gin.New()
	apiRouter.Use(gin.Recovery())
	apiRouter.Use(s.loggerMiddleware())
	apiRouter.Use(s.corsMiddleware())

	s.setupAPIRoutes(apiRouter)

	s.apiServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.config.Port),
		Handler:      apiRouter,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// WebUI Server
	webUIRouter := gin.New()
	webUIRouter.Use(gin.Recovery())
	webUIRouter.Use(s.loggerMiddleware())
	s.setupWebUIRoutes(webUIRouter)

	s.webUIServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.config.WebUIPort),
		Handler:      webUIRouter,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// Start servers
	go func() {
		s.logger.Info("Starting API server", zap.Int("port", s.config.Port))
		if err := s.apiServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Fatal("API server error", zap.Error(err))
		}
	}()

	go func() {
		s.logger.Info("Starting WebUI server", zap.Int("port", s.config.WebUIPort))
		if err := s.webUIServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Fatal("WebUI server error", zap.Error(err))
		}
	}()

	// Start event broadcaster
	go s.broadcastEvents(ctx)

	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("Shutting down servers...")

	// Close WebSocket connections
	s.wsMutex.Lock()
	for conn := range s.wsClients {
		conn.Close()
	}
	s.wsClients = make(map[*websocket.Conn]bool)
	s.wsMutex.Unlock()

	// Shutdown HTTP servers
	if err := s.apiServer.Shutdown(ctx); err != nil {
		s.logger.Error("API server shutdown error", zap.Error(err))
	}
	if err := s.webUIServer.Shutdown(ctx); err != nil {
		s.logger.Error("WebUI server shutdown error", zap.Error(err))
	}

	return nil
}

func (s *Server) setupAPIRoutes(r *gin.Engine) {
	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "network-scanner"})
	})

	// WebSocket endpoint
	r.GET("/ws", s.handleWebSocket)

	// API v1
	v1 := r.Group("/api/v1")
	{
		// Scans
		v1.POST("/scans", s.createScan)
		v1.GET("/scans", s.listScans)
		v1.GET("/scans/:id", s.getScan)
		v1.DELETE("/scans/:id", s.deleteScan)
		v1.POST("/scans/:id/stop", s.stopScan)

		// Devices
		v1.GET("/scans/:id/devices", s.getScanDevices)
		v1.GET("/devices/:ip", s.getDevice)
		v1.GET("/devices/:ip/fingerprint", s.getDeviceFingerprint)

		// Hostname resolution
		v1.POST("/resolve", s.resolveHostname)
		v1.GET("/resolve/:ip", s.getCachedResolution)

		// Interfaces
		v1.GET("/interfaces", s.getInterfaces)

		// Stats
		v1.GET("/stats", s.getStats)
	}
}

func (s *Server) setupWebUIRoutes(r *gin.Engine) {
	// Serve embedded WebUI
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/" || path == "/index.html" {
			data, _ := webUIFS.ReadFile("webui/dist/index.html")
			c.Data(http.StatusOK, "text/html", data)
			return
		}

		// Try to serve from embedded FS
		filePath := "webui/dist" + path
		data, err := webUIFS.ReadFile(filePath)
		if err == nil {
			contentType := getContentType(path)
			c.Data(http.StatusOK, contentType, data)
			return
		}

		// Fallback to index.html for SPA routing
		data, _ = webUIFS.ReadFile("webui/dist/index.html")
		c.Data(http.StatusOK, "text/html", data)
	})
}

func (s *Server) loggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		s.logger.Debug("HTTP request",
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(start)),
			zap.String("ip", c.ClientIP()),
		)
	}
}

func (s *Server) corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// WebSocket handling
func (s *Server) handleWebSocket(c *gin.Context) {
	conn, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		s.logger.Error("WebSocket upgrade failed", zap.Error(err))
		return
	}

	s.wsMutex.Lock()
	s.wsClients[conn] = true
	s.wsMutex.Unlock()

	s.logger.Debug("WebSocket client connected", zap.String("remote", conn.RemoteAddr().String()))

	// Handle incoming messages
	go func() {
		defer func() {
			conn.Close()
			s.wsMutex.Lock()
			delete(s.wsClients, conn)
			s.wsMutex.Unlock()
			s.logger.Debug("WebSocket client disconnected")
		}()

		for {
			var msg WebSocketMessage
			if err := conn.ReadJSON(&msg); err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					s.logger.Error("WebSocket read error", zap.Error(err))
				}
				break
			}
			s.handleWSMessage(conn, msg)
		}
	}()
}

func (s *Server) handleWSMessage(conn *websocket.Conn, msg WebSocketMessage) {
	switch msg.Type {
	case "ping":
		conn.WriteJSON(WebSocketMessage{Type: "pong", Payload: nil})
	case "subscribe":
		// Handle subscription to scan updates
		conn.WriteJSON(WebSocketMessage{Type: "subscribed", Payload: msg.Payload})
	}
}

func (s *Server) broadcastEvents(ctx context.Context) {
	// Subscribe to scan events from Kafka or internal channel
	// This is a simplified version - in production use Kafka consumer
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Broadcast periodic updates
			s.broadcastScanUpdates()
		}
	}
}

func (s *Server) broadcastScanUpdates() {
	scans := s.scanEngine.ListScans()
	for _, scan := range scans {
		if scan.Status == "running" {
			msg := WebSocketMessage{
				Type: "scan_update",
				Payload: gin.H{
					"scan_id":  scan.ID,
					"progress": scan.Progress,
					"found":    len(scan.Devices),
					"status":   scan.Status,
				},
			}
			s.broadcast(msg)
		}
	}
}

func (s *Server) broadcast(msg WebSocketMessage) {
	s.wsMutex.Lock()
	defer s.wsMutex.Unlock()

	for conn := range s.wsClients {
		if err := conn.WriteJSON(msg); err != nil {
			s.logger.Error("WebSocket write error", zap.Error(err))
			conn.Close()
			delete(s.wsClients, conn)
		}
	}
}

// API Handlers
func (s *Server) createScan(c *gin.Context) {
	var req struct {
		Interface string   `json:"interface" binding:"required"`
		CIDR      string   `json:"cidr" binding:"required"`
		Ports     []int    `json:"ports"`
		Options   map[string]interface{} `json:"options"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Default ports if not specified
	if len(req.Ports) == 0 {
		req.Ports = []int{22, 80, 443, 445, 139, 135, 8080, 3389, 5900, 8006}
	}

	scan := &scanner.Scan{
		ID:        generateID(),
		Interface: req.Interface,
		CIDR:      req.CIDR,
		Ports:     req.Ports,
		Status:    "pending",
		Progress:  0,
		Devices:   []scanner.Device{},
		StartedAt: time.Now(),
		Options:   req.Options,
	}

	if err := s.scanEngine.StartScan(scan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, scan)
}

func (s *Server) listScans(c *gin.Context) {
	scans := s.scanEngine.ListScans()
	c.JSON(http.StatusOK, gin.H{"scans": scans})
}

func (s *Server) getScan(c *gin.Context) {
	id := c.Param("id")
	scan, ok := s.scanEngine.GetScan(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Scan not found"})
		return
	}
	c.JSON(http.StatusOK, scan)
}

func (s *Server) deleteScan(c *gin.Context) {
	// In a real implementation, remove from storage
	c.JSON(http.StatusOK, gin.H{"message": "Scan deleted"})
}

func (s *Server) stopScan(c *gin.Context) {
	// In a real implementation, cancel the scan context
	c.JSON(http.StatusOK, gin.H{"message": "Scan stop requested"})
}

func (s *Server) getScanDevices(c *gin.Context) {
	id := c.Param("id")
	scan, ok := s.scanEngine.GetScan(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Scan not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"devices": scan.Devices})
}

func (s *Server) getDevice(c *gin.Context) {
	ip := c.Param("ip")
	// Search across all scans
	scans := s.scanEngine.ListScans()
	for _, scan := range scans {
		for _, device := range scan.Devices {
			if device.IP == ip {
				c.JSON(http.StatusOK, device)
				return
			}
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "Device not found"})
}

func (s *Server) getDeviceFingerprint(c *gin.Context) {
	ip := c.Param("ip")
	scans := s.scanEngine.ListScans()
	for _, scan := range scans {
		for _, device := range scan.Devices {
			if device.IP == ip {
				// Get ports as int slice
				ports := make([]int, len(device.Ports))
				for i, p := range device.Ports {
					ports[i] = p.Port
				}

				fp := s.fingerprintEngine.FingerprintDevice(device.IP, device.MAC, ports, device.Hostnames)
				c.JSON(http.StatusOK, fp)
				return
			}
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "Device not found"})
}

func (s *Server) resolveHostname(c *gin.Context) {
	var req struct {
		IP string `json:"ip" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := s.resolverEngine.Resolve(req.IP)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) getCachedResolution(c *gin.Context) {
	ip := c.Param("ip")
	result, err := s.resolverEngine.Resolve(ip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) getInterfaces(c *gin.Context) {
	interfaces, err := net.Interfaces()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var result []gin.H
	for _, iface := range interfaces {
		addrs, _ := iface.Addrs()
		var ips []string
		for _, addr := range addrs {
			ips = append(ips, addr.String())
		}
		result = append(result, gin.H{
			"name":        iface.Name,
			"index":       iface.Index,
			"mtu":         iface.MTU,
			"flags":       iface.Flags.String(),
			"hardware_addr": iface.HardwareAddr.String(),
			"ips":         ips,
		})
	}
	c.JSON(http.StatusOK, gin.H{"interfaces": result})
}

func (s *Server) getStats(c *gin.Context) {
	scans := s.scanEngine.ListScans()
	totalDevices := 0
	runningScans := 0
	for _, scan := range scans {
		totalDevices += len(scan.Devices)
		if scan.Status == "running" {
			runningScans++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total_scans":      len(scans),
		"running_scans":    runningScans,
		"total_devices":    totalDevices,
		"websocket_clients": len(s.wsClients),
	})
}

func generateID() string {
	return fmt.Sprintf("%d-%s", time.Now().UnixNano(), randomString(8))
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func getContentType(path string) string {
	if strings.HasSuffix(path, ".js") {
		return "application/javascript"
	}
	if strings.HasSuffix(path, ".css") {
		return "text/css"
	}
	if strings.HasSuffix(path, ".html") {
		return "text/html"
	}
	if strings.HasSuffix(path, ".json") {
		return "application/json"
	}
	if strings.HasSuffix(path, ".png") {
		return "image/png"
	}
	if strings.HasSuffix(path, ".svg") {
		return "image/svg+xml"
	}
	if strings.HasSuffix(path, ".ico") {
		return "image/x-icon"
	}
	return "application/octet-stream"
}