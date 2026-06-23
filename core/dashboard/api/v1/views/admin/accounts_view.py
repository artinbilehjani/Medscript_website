from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from django.shortcuts import get_object_or_404
from ...serializers import UserAdminSerializer, PositionAdminSerializer
from accounts.models import User, Position

# ── Positions ─────────────────────────────────


class PositionListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(PositionAdminSerializer(Position.objects.all(), many=True).data)

    def post(self, request):
        s = PositionAdminSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data, status=status.HTTP_201_CREATED)


class PositionDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _obj(self, pk):
        return get_object_or_404(Position, pk=pk)

    def patch(self, request, pk):
        s = PositionAdminSerializer(self._obj(pk), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request, pk):
        self._obj(pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Users ─────────────────────────────────────


class UserListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = User.objects.select_related("profile", "user_position").order_by(
            "username"
        )
        return Response(UserAdminSerializer(qs, many=True).data)


class UserDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _obj(self, pk):
        return get_object_or_404(User, pk=pk)

    def get(self, request, pk):
        return Response(UserAdminSerializer(self._obj(pk)).data)

    def patch(self, request, pk):
        """Patch is_staff, is_active, type, user_position only."""
        allowed = {"is_staff", "is_active", "type", "user_position"}
        data = {k: v for k, v in request.data.items() if k in allowed}
        s = UserAdminSerializer(self._obj(pk), data=data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)
