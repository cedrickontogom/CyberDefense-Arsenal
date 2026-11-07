from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import AuditLog, UserRole, APIKey

User = get_user_model()


@receiver(pre_save, sender=User)
def user_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = User.objects.get(pk=instance.pk)
            instance._old_roles = set(old_instance.roles.values_list('id', flat=True))
        except User.DoesNotExist:
            instance._old_roles = set()
    else:
        instance._old_roles = set()


@receiver(post_save, sender=User)
def user_post_save(sender, instance, created, **kwargs):
    if created:
        AuditLog.objects.create(
            user=instance,
            action='create',
            resource_type='user',
            resource_id=str(instance.id),
            changes={'email': instance.email, 'username': instance.username},
            success=True,
        )
        # Assign default role
        default_role, _ = Role.objects.get_or_create(
            name='analyst',
            defaults={'description': 'Default analyst role', 'permissions': {'permissions': ['alerts.view', 'cases.view']}}
        )
        UserRole.objects.get_or_create(user=instance, role=default_role)
    else:
        # Check role changes
        new_roles = set(instance.roles.values_list('id', flat=True))
        added_roles = new_roles - instance._old_roles
        removed_roles = instance._old_roles - new_roles

        if added_roles or removed_roles:
            AuditLog.objects.create(
                user=instance,
                action='update_roles',
                resource_type='user',
                resource_id=str(instance.id),
                changes={
                    'added_roles': list(added_roles),
                    'removed_roles': list(removed_roles),
                },
                success=True,
            )


@receiver(post_save, sender=UserRole)
def user_role_post_save(sender, instance, created, **kwargs):
    if created:
        AuditLog.objects.create(
            user=instance.assigned_by,
            action='assign_role',
            resource_type='user_role',
            resource_id=str(instance.id),
            changes={
                'user': str(instance.user_id),
                'role': str(instance.role_id),
            },
            success=True,
        )


@receiver(post_save, sender=APIKey)
def api_key_post_save(sender, instance, created, **kwargs):
    if created:
        AuditLog.objects.create(
            user=instance.user,
            action='create',
            resource_type='api_key',
            resource_id=str(instance.id),
            changes={'name': instance.name, 'scopes': instance.scopes},
            success=True,
        )