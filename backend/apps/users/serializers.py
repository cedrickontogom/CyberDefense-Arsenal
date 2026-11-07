from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import Role, Permission, UserRole, APIKey, UserSession, AuditLog

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'codename', 'name', 'description', 'category', 'created_at']
        read_only_fields = ['id', 'created_at']


class RoleSerializer(serializers.ModelSerializer):
    permissions_detail = PermissionSerializer(source='permissions', many=True, read_only=True)
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions', 'permissions_detail',
                  'is_system', 'user_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()


class RoleCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['name', 'description', 'permissions', 'is_system']

    def validate_permissions(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Permissions must be a dictionary")
        return value


class UserSerializer(serializers.ModelSerializer):
    roles_detail = RoleSerializer(source='roles', many=True, read_only=True)
    permissions = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name',
                  'phone', 'timezone', 'language', 'is_active', 'is_verified',
                  'is_staff', 'is_superuser', 'mfa_enabled', 'mfa_enforced',
                  'roles', 'roles_detail', 'permissions', 'preferences',
                  'dashboard_config', 'last_login', 'date_joined', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_staff', 'is_superuser', 'last_login',
                            'date_joined', 'created_at', 'updated_at', 'permissions']

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_permissions(self, obj):
        return list(obj.get_all_permissions())


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    roles = serializers.PrimaryKeyRelatedField(queryset=Role.objects.filter(is_system=False), many=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name',
                  'last_name', 'phone', 'timezone', 'language', 'roles',
                  'is_active', 'is_verified', 'mfa_enforced']

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match"})
        return attrs

    def create(self, validated_data):
        roles = validated_data.pop('roles', [])
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        for role in roles:
            UserRole.objects.create(user=user, role=role, assigned_by=self.context['request'].user)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    roles = serializers.PrimaryKeyRelatedField(queryset=Role.objects.filter(is_system=False), many=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'phone',
                  'timezone', 'language', 'roles', 'is_active', 'is_verified',
                  'mfa_enabled', 'mfa_enforced', 'preferences', 'dashboard_config']

    def update(self, instance, validated_data):
        roles = validated_data.pop('roles', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if roles is not None:
            # Remove old roles
            instance.user_roles.all().delete()
            # Add new roles
            for role in roles:
                UserRole.objects.create(user=instance, role=role, assigned_by=self.context['request'].user)

        return instance


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match"})
        user = self.context['request'].user
        if not user.check_password(attrs['old_password']):
            raise serializers.ValidationError({"old_password": "Current password is incorrect"})
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class MFASetupSerializer(serializers.Serializer):
    secret = serializers.CharField(read_only=True)
    qr_code = serializers.CharField(read_only=True)
    recovery_codes = serializers.ListField(child=serializers.CharField(), read_only=True)


class MFAVerifySerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6, min_length=6)
    recovery_code = serializers.CharField(max_length=10, min_length=8, required=False)


class APIKeySerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    full_key = serializers.CharField(read_only=True)

    class Meta:
        model = APIKey
        fields = ['id', 'name', 'key_prefix', 'full_key', 'user', 'user_email',
                  'scopes', 'expires_at', 'last_used_at', 'last_used_ip',
                  'is_active', 'created_at']
        read_only_fields = ['id', 'key_prefix', 'full_key', 'user', 'user_email',
                            'last_used_at', 'last_used_ip', 'created_at']


class APIKeyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ['name', 'scopes', 'expires_at']


class UserSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSession
        fields = ['id', 'session_key', 'ip_address', 'user_agent', 'location',
                  'is_current', 'created_at', 'last_activity', 'expires_at']
        read_only_fields = fields


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_email', 'action', 'resource_type', 'resource_id',
                  'changes', 'ip_address', 'user_agent', 'success', 'error_message',
                  'metadata', 'created_at']
        read_only_fields = fields