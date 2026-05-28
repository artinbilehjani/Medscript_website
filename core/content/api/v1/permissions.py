from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.author.user == request.user


from rest_framework import permissions
from django.contrib.auth import get_user_model
from accounts.models import User


class CustomTripleAccessPermission(permissions.BasePermission):

    def has_permission(self, request, view):
        
        user = request.user

        if user and user.is_superuser:
            return True

        if user and user.is_staff:
            if request.method in permissions.SAFE_METHODS:
                return True
            return True

        if request.method in permissions.SAFE_METHODS:
            return True

        return False

    def has_object_permission(self, request, view, obj):
        
        user = request.user

        if user and user.is_superuser:
            return True

        if user and user.is_staff:
            if hasattr(obj, "author") and obj.author and obj.author.user == user:
                return True
            if request.method in permissions.SAFE_METHODS:
                return True
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return False