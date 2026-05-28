from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.utils.translation import gettext_lazy as _
from django.db.models.signals import post_save
from django.dispatch import receiver
# Create your models here.


class UserManager(BaseUserManager):
    """
    Custom user model manager where username is the unique identifiers
    for authentication instead of usernames.
    """

    def create_user(self, username, password, **extra_fields):
        if not username:
            raise ValueError(_("A username is required."))
        if not password:
            raise ValueError(_("Users must have a password"))
        username = self.model.normalize_username(username)
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("type", User.UserType.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True"))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True"))

        return self.create_user(username, password, **extra_fields)




class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User Model for our app
    """
    class UserType(models.IntegerChoices):
        CUSTOMER = 1, _("customer")
        ADMIN = 2, _("admin")

    username = models.CharField(verbose_name='username',max_length=50, unique=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    type = models.IntegerField(choices=UserType.choices, default=UserType.CUSTOMER)
    user_position = models.ForeignKey(
    "Position",
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="users",
)
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    objects = UserManager()

    class Meta:
        ordering = ["username"]
        verbose_name = _("User")
        verbose_name_plural = _("Users")

    def __str__(self):
        return self.username
    
    

class Position(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name
    

class Profile(models.Model):
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=50)
    image = models.ImageField(upload_to='images/profile_pictures/', default='images/default_images/blank_profile_picture.png')
    email = models.EmailField(unique=True,null=True,blank=True)
    description = models.TextField(null=True,blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.username


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(
            user=instance,
            display_name=instance.username,
        )