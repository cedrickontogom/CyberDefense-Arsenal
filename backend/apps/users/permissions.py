from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """Allow only admin/superuser access."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (
            request.user.is_superuser or request.user.has_role('admin')
        )


class IsSelfOrAdmin(permissions.BasePermission):
    """Allow users to access their own resources, admins can access all."""
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or request.user.has_role('admin'):
            return True
        return obj == request.user or getattr(obj, 'user', None) == request.user


class HasPermission(permissions.BasePermission):
    """Check if user has required permission for the action."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        required_perms = getattr(view, 'required_permissions', {})
        action = view.action if hasattr(view, 'action') else request.method.lower()
        perm = required_perms.get(action)

        if not perm:
            return True

        return request.user.has_perm(perm)


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Object-level permission to only allow owners to edit."""
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.user == request.user or request.user.is_superuser