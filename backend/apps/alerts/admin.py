from django.contrib import admin
from .models import Connector, Alert, AlertComment, AlertAttachment, AlertRule, IngestionMetrics


@admin.register(Connector)
class ConnectorAdmin(admin.ModelAdmin):
    list_display = ['name', 'connector_type', 'status', 'is_active', 'last_run', 'last_success', 'total_events', 'created_at']
    list_filter = ['connector_type', 'status', 'is_active', 'created_at']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at', 'last_run', 'last_success', 'last_error', 'total_events', 'events_last_hour']
    raw_id_fields = ['created_by']


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['alert_id', 'title', 'severity', 'status', 'connector', 'host', 'user', 'source_ip', 'occurred_at', 'received_at']
    list_filter = ['severity', 'status', 'connector', 'is_correlated', 'occurred_at', 'received_at']
    search_fields = ['alert_id', 'title', 'description', 'host', 'user', 'source_ip']
    readonly_fields = ['received_at', 'created_at', 'updated_at', 'alert_id']
    raw_id_fields = ['connector', 'assigned_to', 'parent_alert']
    date_hierarchy = 'occurred_at'
    ordering = ['-occurred_at']


@admin.register(AlertComment)
class AlertCommentAdmin(admin.ModelAdmin):
    list_display = ['alert', 'user', 'is_internal', 'created_at']
    list_filter = ['is_internal', 'created_at']
    search_fields = ['content', 'user__email']
    raw_id_fields = ['alert', 'user']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(AlertAttachment)
class AlertAttachmentAdmin(admin.ModelAdmin):
    list_display = ['alert', 'filename', 'content_type', 'size', 'uploaded_by', 'created_at']
    list_filter = ['content_type', 'created_at']
    search_fields = ['filename', 'alert__alert_id']
    raw_id_fields = ['alert', 'uploaded_by']
    readonly_fields = ['created_at']


@admin.register(AlertRule)
class AlertRuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'rule_type', 'priority', 'is_active', 'match_count', 'last_matched', 'created_at']
    list_filter = ['rule_type', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['match_count', 'last_matched', 'created_at', 'updated_at']
    raw_id_fields = ['created_by']


@admin.register(IngestionMetrics)
class IngestionMetricsAdmin(admin.ModelAdmin):
    list_display = ['connector', 'timestamp', 'events_received', 'events_processed', 'events_failed', 'alerts_created']
    list_filter = ['connector', 'timestamp']
    readonly_fields = ['created_at']
    date_hierarchy = 'timestamp'
    ordering = ['-timestamp']