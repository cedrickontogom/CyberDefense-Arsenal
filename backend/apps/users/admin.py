from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, Permission, UserRole, APIKey, UserSession, AuditLog


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'username', 'full_name', 'is_active', 'is_verified', 'mfa_enabled', 'roles_list', 'created_at']
    list_filter = ['is_active', 'is_verified', 'is_staff', 'is_superuser', 'mfa_enabled', 'roles', 'created_at']
    search_fields = ['email', 'username', 'first_name', 'last_name', 'phone']
    ordering = ['-created_at']
    readonly_fields = ['last_login', 'date_joined', 'created_at', 'updated_at', 'failed_login_attempts', 'locked_until']

    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone', 'timezone', 'language')}),
        ('Security', {'fields': ('mfa_enabled', 'mfa_secret', 'mfa_recovery_codes', 'mfa_enforced',
                                  'failed_login_attempts', 'locked_until')}),
        ('Permissions', {'fields': ('is_active', 'is_verified', 'is_staff', 'is_superuser',
                                     'roles', 'direct_permissions', 'groups', 'user_permissions')}),
        ('Preferences', {'fields': ('preferences', 'dashboard_config')}),
        ('Audit', {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'first_name', 'last_name'),
        }),
    )

    filter_horizontal = ['roles', 'direct_permissions', 'groups', 'user_permissions']

    def full_name(self, obj):
        return obj.get_full_name()
    full_name.short_description = 'Full Name'

    def roles_list(self, obj):
        return ', '.join([r.name for r in obj.roles.all()])
    roles_list.short_description = 'Roles'


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_system', 'user_count', 'created_at']
    list_filter = ['is_system', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    filter_horizontal = ['users']

    def user_count(self, obj):
        return obj.users.count()
    user_count.short_description = 'Users'


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['codename', 'name', 'category', 'created_at']
    list_filter = ['category', 'created_at']
    search_fields = ['codename', 'name', 'description']
    readonly_fields = ['created_at']


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'assigned_by', 'assigned_at', 'expires_at', 'is_active']
    list_filter = ['is_active', 'role', 'assigned_at']
    search_fields = ['user__email', 'user__username', 'role__name']
    readonly_fields = ['assigned_at']


@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    list_display = ['name', 'key_prefix', 'user', 'scopes', 'expires_at', 'last_used_at', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at', 'expires_at']
    search_fields = ['name', 'user__email', 'key_prefix']
    readonly_fields = ['key_hash', 'key_prefix', 'created_at', 'last_used_at', 'last_used_ip']
    raw_id_fields = ['user']


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'ip_address', 'location', 'is_current', 'created_at', 'last_activity', 'expires_at']
    list_filter = ['is_current', 'created_at']
    search_fields = ['user__email', 'ip_address']
    readonly_fields = ['created_at', 'last_activity']
    raw_id_fields = ['user']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'resource_type', 'resource_id', 'success', 'ip_address', 'created_at']
    list_filter = ['action', 'resource_type', 'success', 'created_at']
    search_fields = ['user__email', 'resource_id', 'ip_address']
    readonly_fields = ['created_at']
    raw_id_fields = ['user']
    date_hierarchy = 'created_at'