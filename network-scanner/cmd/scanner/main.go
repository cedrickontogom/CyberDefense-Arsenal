package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"cyberdefense-arsenal/network-scanner/internal/api"
	"cyberdefense-arsenal/network-scanner/internal/scanner"
	"cyberdefense-arsenal/network-scanner/internal/resolver"
	"cyberdefense-arsenal/network-scanner/internal/fingerprint"
)

var (
	version   = "dev"
	buildTime = "unknown"
	gitCommit = "unknown"
)

func main() {
	var rootCmd = &cobra.Command{
		Use:   "network-scanner",
		Short: "CyberDefense Arsenal Network Scanner",
		Long:  `Fast network discovery tool with REST API and WebSocket support`,
		Run:   runServer,
	}

	rootCmd.Flags().String("config", "", "Config file path")
	rootCmd.Flags().Int("port", 7331, "API server port")
	rootCmd.Flags().Int("webui-port", 7332, "WebUI server port")
	rootCmd.Flags().String("redis", "redis://localhost:6379/1", "Redis URL")
	rootCmd.Flags().String("kafka", "localhost:9092", "Kafka brokers")
	rootCmd.Flags().String("log-level", "info", "Log level (debug, info, warn, error)")
	rootCmd.Flags().Int("workers", 50, "Number of scan workers")
	rootCmd.Flags().Bool("debug", false, "Enable debug mode")

	viper.BindPFlags(rootCmd.Flags())
	viper.SetEnvPrefix("SCANNER")
	viper.AutomaticEnv()

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runServer(cmd *cobra.Command, args []string) {
	// Initialize logger
	loggerConfig := zap.NewProductionConfig()
	loggerConfig.Level = zap.NewAtomicLevelAt(zapcoreLevel(viper.GetString("log-level")))
	logger, _ := loggerConfig.Build()
	defer logger.Sync()

	logger.Info("Starting Network Scanner",
		zap.String("version", version),
		zap.String("build_time", buildTime),
		zap.String("git_commit", gitCommit),
	)

	// Initialize components
	scanEngine := scanner.NewEngine(logger, scanner.Config{
		Workers:     viper.GetInt("workers"),
		RedisURL:    viper.GetString("redis"),
		KafkaBrokers: viper.GetString("kafka"),
	})

	resolverEngine := resolver.NewEngine(logger, resolver.Config{
		RedisURL: viper.GetString("redis"),
	})

	fingerprintEngine := fingerprint.NewEngine(logger)

	// Setup HTTP servers
	apiServer := api.NewServer(logger, api.Config{
		Port:             viper.GetInt("port"),
		WebUIPort:        viper.GetInt("webui-port"),
		ScanEngine:       scanEngine,
		ResolverEngine:   resolverEngine,
		FingerprintEngine: fingerprintEngine,
	})

	// Start servers
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := apiServer.Start(ctx); err != nil && err != http.ErrServerClosed {
			logger.Fatal("API server failed", zap.Error(err))
		}
	}()

	logger.Info("Network Scanner started",
		zap.Int("api_port", viper.GetInt("port")),
		zap.Int("webui_port", viper.GetInt("webui-port")),
	)

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	logger.Info("Shutting down...")
	cancel()

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := apiServer.Shutdown(shutdownCtx); err != nil {
		logger.Error("Server shutdown error", zap.Error(err))
	}

	scanEngine.Close()
	resolverEngine.Close()

	logger.Info("Network Scanner stopped")
}

func zapcoreLevel(level string) zapcore.Level {
	switch level {
	case "debug":
		return zapcore.DebugLevel
	case "warn":
		return zapcore.WarnLevel
	case "error":
		return zapcore.ErrorLevel
	default:
		return zapcore.InfoLevel
	}
}