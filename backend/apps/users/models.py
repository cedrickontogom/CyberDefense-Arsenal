import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class Role(models.Model):
    """Role-based access control roles."""
    name = models.CharField(_('name'), max_length=100, unique=True)
    description = models.TextField(_('description'), blank=True)
    permissions = models.JSONField(_('permissions'), default=dict, blank=True)
    is_system = models.BooleanField(_('system role'), default=False)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _('role')
        verbose_name_plural = _('roles')
        ordering = ['name']

    def __str__(self):
        return self.name


class Permission(models.Model):
    """Granular permissions."""
    codename = models.CharField(_('codename'), max_length=100, unique=True)
    name = models.CharField(_('name'), max_length=255)
    description = models.TextField(_('description'), blank=True)
    category = models.CharField(_('category'), max_length=50)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)

    class Meta:
        verbose_name = _('permission')
        verbose_name_plural = _('permissions')
        ordering = ['category', 'codename']

    def __str__(self):
        return f"{self.category}.{self.codename}"


class User(AbstractUser):
    """Extended user model with MFA, API keys, and RBAC."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_('email address'), unique=True)
    phone = models.CharField(_('phone'), max_length=30, blank=True)
    timezone = models.CharField(_('timezone'), max_length=50, default='UTC')
    language = models.CharField(_('language'), max_length=10, default='fr')

    # MFA
    mfa_enabled = models.BooleanField(_('MFA enabled'), default=False)
    mfa_secret = models.CharField(_('MFA secret'), max_length=32, blank=True)
    mfa_recovery_codes = models.JSONField(_('MFA recovery codes'), default=list, blank=True)
    mfa_enforced = models.BooleanField(_('MFA enforced'), default=False)

    # Status
    is_active = models.BooleanField(_('active'), default=True)
    is_verified = models.BooleanField(_('verified'), default=False)
    last_login_ip = models.GenericIPAddressField(_('last login IP'), null=True, blank=True)
    failed_login_attempts = models.PositiveIntegerField(_('failed login attempts'), default=0)
    locked_until = models.DateTimeField(_('locked until'), null=True, blank=True)

    # Preferences
    preferences = models.JSONField(_('preferences'), default=dict, blank=True)
    dashboard_config = models.JSONField(_('dashboard config'), default=dict, blank=True)

    # RBAC
    roles = models.ManyToManyField(Role, through='UserRole', related_name='users', blank=True)
    direct_permissions = models.ManyToManyField(Permission, related_name='users', blank=True)

    # Audit
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    history = HistoricalRecords()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['username']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

    def get_short_name(self):
        return self.first_name or self.username

    def has_perm(self, perm, obj=None):
        """Check if user has permission."""
        if self.is_superuser:
            return True

        # Check direct permissions
        if self.direct_permissions.filter(codename=perm).exists():
            return True

        # Check role permissions
        for role in self.roles.filter(is_active=True):
            if perm in role.permissions.get('permissions', []):
                return True

        return False

    def has_role(self, role_name):
        """Check if user has a specific role."""
        return self.roles.filter(name=role_name, is_active=True).exists()

    def get_all_permissions(self):
        """Get all permissions for user."""
        perms = set(self.direct_permissions.values_list('codename', flat=True))
        for role in self.roles.filter(is_active=True):
            perms.update(role.permissions.get('permissions', []))
        return perms


class UserRole(models.Model):
    """User-Role assignment with expiration."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')
    assigned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='assigned_roles')
    assigned_at = models.DateTimeField(_('assigned at'), auto_now_add=True)
    expires_at = models.DateTimeField(_('expires at'), null=True, blank=True)
    is_active = models.BooleanField(_('active'), default=True)

    class Meta:
        verbose_name = _('user role')
        verbose_name_plural = _('user roles')
        unique_together = ['user', 'role']

    def __str__(self):
        return f"{self.user} - {self.role}"

    def is_expired(self):
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False


class APIKey(models.Model):
    """API keys for programmatic access."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(_('name'), max_length=100)
    key_hash = models.CharField(_('key hash'), max_length=255)
    key_prefix = models.CharField(_('key prefix'), max_length=20)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='api_keys')
    scopes = models.JSONField(_('scopes'), default=list)
    expires_at = models.DateTimeField(_('expires at'), null=True, blank=True)
    last_used_at = models.DateTimeField(_('last used at'), null=True, blank=True)
    last_used_ip = models.GenericIPAddressField(_('last used IP'), null=True, blank=True)
    is_active = models.BooleanField(_('active'), default=True)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = _('API key')
        verbose_name_plural = _('API keys')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"


class UserSession(models.Model):
    """Track active user sessions."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session_key = models.CharField(_('session key'), max_length=40)
    ip_address = models.GenericIPAddressField(_('IP address'))
    user_agent = models.TextField(_('user agent'))
    location = models.CharField(_('location'), max_length=255, blank=True)
    is_current = models.BooleanField(_('current'), default=False)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    last_activity = models.DateTimeField(_('last activity'), auto_now=True)
    expires_at = models.DateTimeField(_('expires at'))

    class Meta:
        verbose_name = _('user session')
        verbose_name_plural = _('user sessions')
        ordering = ['-last_activity']

    def __str__(self):
        return f"{self.user} - {self.ip_address}"


class AuditLog(models.Model):
    """Comprehensive audit logging."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(_('action'), max_length=100)
    resource_type = models.CharField(_('resource type'), max_length=100)
    resource_id = models.CharField(_('resource ID'), max_length=100, blank=True)
    changes = models.JSONField(_('changes'), default=dict, blank=True)
    ip_address = models.GenericIPAddressField(_('IP address'), null=True, blank=True)
    user_agent = models.TextField(_('user agent'), blank=True)
    success = models.BooleanField(_('success'), default=True)
    error_message = models.TextField(_('error message'), blank=True)
    metadata = models.JSONField(_('metadata'), default=dict, blank=True)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)

    class Meta:
        verbose_name = _('audit log')
        verbose_name_plural = _('audit logs')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['action']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.user} - {self.action} - {self.resource_type}"