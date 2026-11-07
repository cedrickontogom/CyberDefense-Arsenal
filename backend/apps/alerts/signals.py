from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Alert, AlertRule, Connector
from apps.users.models import AuditLog

User = get_user_model()
channel_layer = get_channel_layer()


@receiver(pre_save, sender=Alert)
def alert_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = Alert.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
            instance._old_assigned_to = old_instance.assigned_to_id
        except Alert.DoesNotExist:
            instance._old_status = None
            instance._old_assigned_to = None
    else:
        instance._old_status = None
        instance._old_assigned_to = None


@receiver(post_save, sender=Alert)
def alert_post_save(sender, instance, created, **kwargs):
    if created:
        # Broadcast new alert
        async_to_sync(channel_layer.group_send)('alerts', {
            'type': 'alert_created',
            'alert': {
                'id': str(instance.id),
                'alert_id': instance.alert_id,
                'title': instance.title,
                'severity': instance.severity,
                'status': instance.status,
                'connector': instance.connector.name,
                'host': instance.host,
                'user': instance.user,
                'source_ip': str(instance.source_ip) if instance.source_ip else None,
                'occurred_at': instance.occurred_at.isoformat(),
                'received_at': instance.received_at.isoformat(),
            }
        })

        # Check alert rules
        check_alert_rules(instance)

        # Audit log
        AuditLog.objects.create(
            user=None,  # System generated
            action='create',
            resource_type='alert',
            resource_id=str(instance.id),
            changes={'title': instance.title, 'severity': instance.severity},
            success=True,
        )
    else:
        # Check for status/assignment changes
        if hasattr(instance, '_old_status') and instance._old_status != instance.status:
            async_to_sync(channel_layer.group_send)('alerts', {
                'type': 'alert_updated',
                'alert': {
                    'id': str(instance.id),
                    'status': instance.status,
                    'old_status': instance._old_status,
                }
            })

        if hasattr(instance, '_old_assigned_to') and instance._old_assigned_to != instance.assigned_to_id:
            async_to_sync(channel_layer.group_send)('alerts', {
                'type': 'alert_updated',
                'alert': {
                    'id': str(instance.id),
                    'assigned_to': str(instance.assigned_to_id) if instance.assigned_to_id else None,
                    'old_assigned_to': str(instance._old_assigned_to) if instance._old_assigned_to else None,
                }
            })


def check_alert_rules(alert):
    """Evaluate alert rules against new alert."""
    rules = AlertRule.objects.filter(is_active=True).order_by('priority')

    for rule in rules:
        if evaluate_conditions(alert, rule.conditions):
            rule.match_count += 1
            rule.last_matched = timezone.now()
            rule.save(update_fields=['match_count', 'last_matched'])

            # Execute actions
            execute_actions(alert, rule.actions)


def evaluate_conditions(alert, conditions):
    """Evaluate rule conditions against alert."""
    # Simple condition evaluation - can be extended
    for field, expected in conditions.items():
        if field == 'severity':
            if alert.severity not in (expected if isinstance(expected, list) else [expected]):
                return False
        elif field == 'connector_type':
            if alert.connector.connector_type != expected:
                return False
        elif field == 'host_contains':
            if expected.lower() not in (alert.host or '').lower():
                return False
        elif field == 'user_contains':
            if expected.lower() not in (alert.user or '').lower():
                return False
        elif field == 'tags_contains':
            if not any(tag in alert.tags for tag in (expected if isinstance(expected, list) else [expected])):
                return False
    return True


def execute_actions(alert, actions):
    """Execute rule actions."""
    from django.utils import timezone

    for action, params in actions.items():
        if action == 'suppress':
            alert.status = 'false_positive'
            alert.save(update_fields=['status', 'resolved_at'])
        elif action == 'escalate':
            alert.severity = params.get('severity', 'high')
            alert.save(update_fields=['severity'])
        elif action == 'tag':
            tags = params.get('tags', [])
            alert.tags = list(set(alert.tags + tags))
            alert.save(update_fields=['tags'])
        elif action == 'assign':
            user_id = params.get('user_id')
            if user_id:
                alert.assigned_to_id = user_id
                alert.assigned_at = timezone.now()
                alert.save(update_fields=['assigned_to', 'assigned_at'])
        elif action == 'notify':
            # Send notification (email, Slack, etc.)
            pass


@receiver(post_save, sender=Connector)
def connector_post_save(sender, instance, created, **kwargs):
    if created:
        AuditLog.objects.create(
            user=instance.created_by,
            action='create',
            resource_type='connector',
            resource_id=str(instance.id),
            changes={'name': instance.name, 'type': instance.connector_type},
            success=True,
        )