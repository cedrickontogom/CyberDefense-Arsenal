import uuid
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords
from apps.users.models import User


class Connector(models.Model):
    """Data source connectors."""
    CONNECTOR_TYPES = [
        ('webhook', 'Webhook'),
        ('splunk', 'Splunk'),
        ('elastic', 'Elastic/SIEM'),
        ('crowdstrike', 'CrowdStrike'),
        ('sentinel', 'Microsoft Sentinel'),
        ('okta', 'Okta'),
        ('aws', 'AWS CloudTrail'),
        ('gcp', 'GCP Cloud Logging'),
        ('azure', 'Azure Event Hubs'),
        ('syslog', 'Syslog/CEF'),
        ('crowdstrike_fdr', 'CrowdStrike FDR'),
        ('defender', 'Microsoft Defender'),
        ('sentinelone', 'SentinelOne'),
        ('cortex_xdr', 'Cortex XDR'),
        ('qualys', 'Qualys'),
        ('tenable', 'Tenable'),
        ('rapid7', 'Rapid7'),
        ('generic', 'Generic API'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('error', 'Error'),
        ('pending', 'Pending'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(_('name'), max_length=255)
    connector_type = models.CharField(_('type'), max_length=50, choices=CONNECTOR_TYPES)
    status = models.CharField(_('status'), max_length=20, choices=STATUS_CHOICES, default='pending')
    config = models.JSONField(_('configuration'), default=dict)
    credentials = models.JSONField(_('credentials'), default=dict)  # Encrypted
    mapping_rules = models.JSONField(_('field mapping'), default=dict)
    schedule = models.JSONField(_('schedule'), default=dict, blank=True)
    last_run = models.DateTimeField(_('last run'), null=True, blank=True)
    last_success = models.DateTimeField(_('last success'), null=True, blank=True)
    last_error = models.TextField(_('last error'), blank=True)
    total_events = models.BigIntegerField(_('total events'), default=0)
    events_last_hour = models.IntegerField(_('events last hour'), default=0)
    is_active = models.BooleanField(_('active'), default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_connectors')
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _('connector')
        verbose_name_plural = _('connectors')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['connector_type', 'status']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.connector_type})"


class Alert(models.Model):
    """Normalized security alerts."""
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
        ('info', 'Informational'),
    ]

    STATUS_CHOICES = [
        ('new', 'New'),
        ('triaged', 'Triaged'),
        ('investigating', 'Investigating'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
        ('false_positive', 'False Positive'),
        ('duplicate', 'Duplicate'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert_id = models.CharField(_('alert ID'), max_length=255, db_index=True)  # Original ID from source
    title = models.CharField(_('title'), max_length=500)
    description = models.TextField(_('description'), blank=True)
    severity = models.CharField(_('severity'), max_length=20, choices=SEVERITY_CHOICES, default='medium')
    status = models.CharField(_('status'), max_length=20, choices=STATUS_CHOICES, default='new')

    # Source
    connector = models.ForeignKey(Connector, on_delete=models.PROTECT, related_name='alerts')
    source_event = models.JSONField(_('source event'), default=dict)
    raw_data = models.JSONField(_('raw data'), default=dict)

    # Entities
    host = models.CharField(_('host'), max_length=255, blank=True, db_index=True)
    user = models.CharField(_('user'), max_length=255, blank=True, db_index=True)
    source_ip = models.GenericIPAddressField(_('source IP'), null=True, blank=True, db_index=True)
    destination_ip = models.GenericIPAddressField(_('destination IP'), null=True, blank=True)
    destination_port = models.PositiveIntegerField(_('destination port'), null=True, blank=True)

    # MITRE ATT&CK
    mitre_techniques = models.JSONField(_('MITRE techniques'), default=list, blank=True)
    mitre_tactics = models.JSONField(_('MITRE tactics'), default=list, blank=True)

    # IOCs
    iocs = models.JSONField(_('IOCs'), default=dict, blank=True)

    # Enrichment
    enrichment = models.JSONField(_('enrichment'), default=dict, blank=True)
    threat_intel_matches = models.JSONField(_('threat intel matches'), default=list, blank=True)

    # Assignment
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_alerts')
    assigned_at = models.DateTimeField(_('assigned at'), null=True, blank=True)

    # Timing
    occurred_at = models.DateTimeField(_('occurred at'), db_index=True)
    received_at = models.DateTimeField(_('received at'), auto_now_add=True, db_index=True)
    triaged_at = models.DateTimeField(_('triaged at'), null=True, blank=True)
    resolved_at = models.DateTimeField(_('resolved at'), null=True, blank=True)

    # Correlation
    correlation_id = models.UUIDField(_('correlation ID'), null=True, blank=True, db_index=True)
    is_correlated = models.BooleanField(_('correlated'), default=False)
    parent_alert = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='child_alerts')

    # Tags
    tags = models.JSONField(_('tags'), default=list, blank=True)

    # Metadata
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _('alert')
        verbose_name_plural = _('alerts')
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['severity', 'status']),
            models.Index(fields=['connector', 'occurred_at']),
            models.Index(fields=['host', 'occurred_at']),
            models.Index(fields=['user', 'occurred_at']),
            models.Index(fields=['source_ip', 'occurred_at']),
        ]

    def __str__(self):
        return f"[{self.severity.upper()}] {self.title}"


class AlertComment(models.Model):
    """Comments on alerts."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert = models.ForeignKey(Alert, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alert_comments')
    content = models.TextField(_('content'))
    is_internal = models.BooleanField(_('internal'), default=False)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)

    class Meta:
        verbose_name = _('alert comment')
        verbose_name_plural = _('alert comments')
        ordering = ['created_at']

    def __str__(self):
        return f"Comment on {self.alert} by {self.user}"


class AlertAttachment(models.Model):
    """File attachments for alerts."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert = models.ForeignKey(Alert, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(_('file'), upload_to='alerts/attachments/%Y/%m/')
    filename = models.CharField(_('filename'), max_length=255)
    content_type = models.CharField(_('content type'), max_length=100)
    size = models.PositiveIntegerField(_('size'))
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alert_attachments')
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)

    class Meta:
        verbose_name = _('alert attachment')
        verbose_name_plural = _('alert attachments')
        ordering = ['-created_at']

    def __str__(self):
        return self.filename


class AlertRule(models.Model):
    """Custom alert filtering/suppression rules."""
    RULE_TYPES = [
        ('suppress', 'Suppress'),
        ('escalate', 'Escalate'),
        ('tag', 'Tag'),
        ('assign', 'Assign'),
        ('notify', 'Notify'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(_('name'), max_length=255)
    description = models.TextField(_('description'), blank=True)
    rule_type = models.CharField(_('type'), max_length=20, choices=RULE_TYPES)
    conditions = models.JSONField(_('conditions'), default=dict)
    actions = models.JSONField(_('actions'), default=dict)
    priority = models.IntegerField(_('priority'), default=100)
    is_active = models.BooleanField(_('active'), default=True)
    match_count = models.BigIntegerField(_('match count'), default=0)
    last_matched = models.DateTimeField(_('last matched'), null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_alert_rules')
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _('alert rule')
        verbose_name_plural = _('alert rules')
        ordering = ['priority', 'name']

    def __str__(self):
        return f"{self.name} ({self.rule_type})"


class IngestionMetrics(models.Model):
    """Metrics for alert ingestion."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    connector = models.ForeignKey(Connector, on_delete=models.CASCADE, related_name='metrics')
    timestamp = models.DateTimeField(_('timestamp'), db_index=True)
    events_received = models.IntegerField(_('events received'), default=0)
    events_processed = models.IntegerField(_('events processed'), default=0)
    events_failed = models.IntegerField(_('events failed'), default=0)
    alerts_created = models.IntegerField(_('alerts created'), default=0)
    alerts_suppressed = models.IntegerField(_('alerts suppressed'), default=0)
    processing_time_ms = models.FloatField(_('processing time (ms)'), default=0)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)

    class Meta:
        verbose_name = _('ingestion metric')
        verbose_name_plural = _('ingestion metrics')
        ordering = ['-timestamp']
        unique_together = ['connector', 'timestamp']
        indexes = [
            models.Index(fields=['connector', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.connector} - {self.timestamp}"