from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer, LoginSerializer,ProfileSerializer,ChangePasswordSerializer
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated,AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth import logout
from django.contrib.auth import login
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from .utils.captcha import new_math_captcha
from django.contrib.auth import update_session_auth_hash
from rest_framework.generics import DestroyAPIView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.authentication import SessionAuthentication
from django.contrib.auth.password_validation import validate_password, password_changed



# @method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = RegisterSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response({"id": user.id, "username": user.username}, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = LoginSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        login(request, ser.validated_data["user"])
        return Response({"detail": "OK"})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["post"]

    def post(self, request):
        logout(request)
        return Response({"detail": "ok"}, status=status.HTTP_200_OK)
    

class CaptchaView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        key, question = new_math_captcha()
        return Response({"captcha_key": key, "captcha_question": question})
    

class MeProfileView(RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # for image upload

    def get_object(self):
        return self.request.user.profile
    

class ChangePasswordView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    http_method_names = ["post"]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        new_pw = serializer.validated_data["new_password1"]

        user.set_password(new_pw)
        user.save(update_fields=["password"])

        update_session_auth_hash(request, user)  # keeps session valid
        password_changed(new_pw, user=user)

        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)
    
class DeleteMeView(DestroyAPIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["delete"]

    def get_object(self):
        return self.request.user
    
    def perform_destroy(self, instance):
        logout(self.request)
        instance.delete()

@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set"})