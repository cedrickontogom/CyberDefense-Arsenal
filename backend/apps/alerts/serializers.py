from rest_framework import serializers
from .models import Connector, Alert, AlertComment, AlertAttachment, AlertRule, IngestionMetrics
from apps.users.serializers import UserSerializer


class ConnectorSerializer(serializers.ModelSerializer):
    credentials = serializers.JSONField(write_only=True, required=False)
    events_last_hour = serializers.IntegerField(read_only=True)
    total_events = serializers.IntegerField(read_only=True)
    last_run = serializers.DateTimeField(read_only=True)
    last_success = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Connector
        fields = ['id', 'name', 'connector_type', 'status', 'config', 'credentials',
                  'mapping_rules', 'schedule', 'last_run', 'last_success', 'last_error',
                  'total_events', 'events_last_hour', 'is_active', 'created_by',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'status',
                            'last_run', 'last_success', 'last_error', 'total_events', 'events_last_hour']

    def validate_credentials(self, value):
        # Credentials should be encrypted before storage
        return value


class ConnectorListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Connector
        fields = ['id', 'name', 'connector_type', 'status', 'is_active', 'last_run',
                  'last_success', 'total_events', 'events_last_hour', 'created_at']


class AlertSerializer(serializers.ModelSerializer):
    connector_name = serializers.CharField(source='connector.name', read_only=True)
    connector_type = serializers.CharField(source='connector.connector_type', read_only=True)
    assigned_to_detail = UserSerializer(source='assigned_to', read_only=True)
    comments_count = serializers.SerializerMethodField()
    attachments_count = serializers.SerializerMethodField()
    child_alerts_count = serializers.SerializerMethodField()

    class Meta:
        model = Alert
        fields = ['id', 'alert_id', 'title', 'description', 'severity', 'status',
                  'connector', 'connector_name', 'connector_type', 'source_event', 'raw_data',
                  'host', 'user', 'source_ip', 'destination_ip', 'destination_port',
                  'mitre_techniques', 'mitre_tactics', 'iocs', 'enrichment',
                  'threat_intel_matches', 'assigned_to', 'assigned_to_detail',
                  'assigned_at', 'occurred_at', 'received_at', 'triaged_at', 'resolved_at',
                  'correlation_id', 'is_correlated', 'parent_alert', 'tags',
                  'comments_count', 'attachments_count', 'child_alerts_count',
                  'metadata', 'created_at', 'updated_at']
        read_only_fields = ['id', 'alert_id', 'connector', 'source_event', 'raw_data',
                            'received_at', 'created_at', 'updated_at']

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_attachments_count(self, obj):
        return obj.attachments.count()

    def get_child_alerts_count(self, obj):
        return obj.child_alerts.count()


class AlertListSerializer(serializers.ModelSerializer):
    connector_name = serializers.CharField(source='connector.name', read_only=True)
    assigned_to_email = serializers.EmailField(source='assigned_to.email', read_only=True)

    class Meta:
        model = Alert
        fields = ['id', 'alert_id', 'title', 'severity', 'status', 'connector_name',
                  'host', 'user', 'source_ip', 'assigned_to_email', 'occurred_at',
                  'received_at', 'triaged_at', 'is_correlated', 'tags']


class AlertCreateSerializer(serializers.ModelSerializer):
    """For webhook/API ingestion."""
    class Meta:
        model = Alert
        fields = ['alert_id', 'title', 'description', 'severity', 'connector',
                  'source_event', 'raw_data', 'host', 'user', 'source_ip',
                  'destination_ip', 'destination_port', 'mitre_techniques',
                  'mitre_tactics', 'iocs', 'occurred_at', 'tags', 'metadata']

    def create(self, validated_data):
        # Set received_at to now
        validated_data['received_at'] = timezone.now()
        return super().create(validated_data)


class AlertUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['title', 'description', 'severity', 'status', 'host', 'user',
                  'source_ip', 'destination_ip', 'destination_port', 'mitre_techniques',
                  'mitre_tactics', 'iocs', 'tags', 'metadata', 'assigned_to']


class AlertTriageSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Alert.STATUS_CHOICES)
    assigned_to = serializers.UUIDField(required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    comment = serializers.CharField(required=False, allow_blank=True)


class AlertBulkActionSerializer(serializers.Serializer):
    alert_ids = serializers.ListField(child=serializers.UUIDField())
    action = serializers.ChoiceField(choices=[
        'assign', 'unassign', 'change_status', 'add_tags', 'remove_tags',
        'mark_false_positive', 'mark_duplicate', 'merge'
    ])
    parameters = serializers.JSONField(default=dict)


class AlertCommentSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source='user', read_only=True)

    class Meta:
        model = AlertComment
        fields = ['id', 'alert', 'user', 'user_detail', 'content', 'is_internal', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class AlertAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_detail = UserSerializer(source='uploaded_by', read_only=True)

    class Meta:
        model = AlertAttachment
        fields = ['id', 'alert', 'file', 'filename', 'content_type', 'size',
                  'uploaded_by', 'uploaded_by_detail', 'created_at']
        read_only_fields = ['id', 'size', 'uploaded_by', 'created_at']


class AlertRuleSerializer(serializers.ModelSerializer):
    created_by_detail = UserSerializer(source='created_by', read_only=True)

    class Meta:
        model = AlertRule
        fields = ['id', 'name', 'description', 'rule_type', 'conditions', 'actions',
                  'priority', 'is_active', 'match_count', 'last_matched',
                  'created_by', 'created_by_detail', 'created_at', 'updated_at']
        read_only_fields = ['id', 'match_count', 'last_matched', 'created_by', 'created_at', 'updated_at']


class IngestionMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = IngestionMetrics
        fields = '__all__'
        read_only_fields = fields