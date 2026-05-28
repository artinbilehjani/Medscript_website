from django.db import models
from django.db.models import UniqueConstraint
from django.utils.translation import gettext_lazy as _
# Create your models here.


class Comment(models.Model):
    """class for comments of each post"""
    class CommentStatus(models.IntegerChoices):
        PENDING = 1, _("pending")
        APPROVED = 2, _("approved")
        REJECTED = 3, _("rejected")

    post = models.ForeignKey(
        "content.Post",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        "accounts.Profile",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    body = models.TextField(max_length=255)
    status = models.IntegerField(
        choices=CommentStatus.choices,
        default=CommentStatus.PENDING,
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    is_edited = models.BooleanField(default=False)

    class Meta:
        ordering = ["-updated_date"]

    def __str__(self):
        return f"{self.author} - {self.get_snippet()}"

    def get_snippet(self):
        words = self.body.split()
        snippet = " ".join(words[:5])
        if len(words) > 5:
            snippet += "..."
        return snippet
    
    @property
    def like_count(self):
        return self.reactions.filter(reaction_type=CommentReaction.ReactionType.LIKE).count()

    @property
    def dislike_count(self):
        return self.reactions.filter(reaction_type=CommentReaction.ReactionType.DISLIKE).count()
    
class CommentReaction(models.Model):
    class ReactionType(models.IntegerChoices):
        LIKE = 1, ("Like")
        DISLIKE = 2, ("Dislike")

    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="comment_reactions",
    )
    reaction_type = models.IntegerField(
        choices=ReactionType.choices,
    )


    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["comment", "user"],
                name="unique_comment_user_reaction",
            )
        ]

    def __str__(self):
        return f"{self.user} -> {self.comment_id} ({self.get_reaction_type_display()})"