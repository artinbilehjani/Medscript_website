from django.urls import path

from .views import HomeAPIView
from . import views

urlpatterns = [
    path("home/", HomeAPIView.as_view(), name="api-home"),

    # Site Settings
    path("site-settings/",  views.SiteSettingsAdminView.as_view(),  name="admin-site-settings"),

    # Announcements
    path("announcements/",          views.AnnouncementListCreateView.as_view(), name="admin-announcement-list"),
    path("announcements/<int:pk>/", views.AnnouncementDetailView.as_view(),     name="admin-announcement-detail"),
    path("announcements/<int:pk>/toggle-active/", views.AnnouncementToggleActiveView.as_view(), name="admin-announcement-toggle"),

    # Homepage Sections
    path("homepage-sections/",                          views.HomepageSectionListView.as_view(),         name="admin-section-list"),
    path("homepage-sections/reorder/",                  views.HomepageSectionReorderView.as_view(),      name="admin-section-reorder"),
    path("homepage-sections/<int:pk>/",                 views.HomepageSectionDetailView.as_view(),       name="admin-section-detail"),
    path("homepage-sections/<int:pk>/toggle-active/",   views.HomepageSectionToggleActiveView.as_view(), name="admin-section-toggle"),

    # Posts
    path("posts/",                    views.PostListCreateView.as_view(), name="admin-post-list"),
    path("posts/<int:pk>/",           views.PostDetailView.as_view(),     name="admin-post-detail"),
    path("posts/<int:pk>/publish/",   views.PostPublishView.as_view(),    name="admin-post-publish"),
    path("posts/<int:pk>/unpublish/", views.PostUnpublishView.as_view(),  name="admin-post-unpublish"),

    # Tags
    path("tags/",views.TagListCreateView.as_view(),  name="admin-tag-list"),
    path("tags/<int:pk>/", views.TagDetailView.as_view(),      name="admin-tag-detail"),

    # Categories
    path("categories/", views.CategoryListCreateView.as_view(), name="admin-category-list"),
    path("categories/<int:pk>/", views.CategoryDetailView.as_view(),     name="admin-category-detail"),

    # Post full editor
    path("posts/<int:pk>/editor/", views.PostEditorDetailView.as_view(),   name="admin-post-editor"),
    path("posts/<int:post_pk>/files/", views.PostFileListCreateView.as_view(), name="admin-postfile-list"),
    path("posts/<int:post_pk>/files/<int:pk>/", views.PostFileDetailView.as_view(),     name="admin-postfile-detail"),
 
    # Comments
    path("comments/", views.CommentListView.as_view(),    name="admin-comment-list"),
    path("comments/<int:pk>/", views.CommentDetailView.as_view(),  name="admin-comment-detail"),
    path("comments/<int:pk>/approve/", views.CommentApproveView.as_view(), name="admin-comment-approve"),
    path("comments/<int:pk>/reject/", views.CommentRejectView.as_view(),  name="admin-comment-reject"),
 
    # Positions
    path("positions/", views.PositionListCreateView.as_view(), name="admin-position-list"),
    path("positions/<int:pk>/", views.PositionDetailView.as_view(),     name="admin-position-detail"),
 
    # Users
    path("users/", views.UserListView.as_view(),   name="admin-user-list"),
    path("users/<int:pk>/", views.UserDetailView.as_view(), name="admin-user-detail"),
]
