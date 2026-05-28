from rest_framework import serializers
from ...models import Post, Category,Tag,PostFile
from accounts.models import Profile
from rest_framework.parsers import JSONParser

class PostFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostFile
        fields = ["id", "file"]

# serializers.py

class RecursiveCategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "children"]

    def get_children(self, obj):
        children = obj.children.all()
        return RecursiveCategorySerializer(children, many=True).data

class TagSerializer(serializers.ModelSerializer):

    class Meta:
        model = Tag
        fields = ["name", "id"]

class PostSerializer(serializers.ModelSerializer):
    # content = serializers.ReadOnlyField()
    snippet = serializers.ReadOnlyField(source="get_snippets")
    relative_url = serializers.URLField(source="get_absolute_api_url", read_only=True)
    absolute_url = serializers.SerializerMethodField(method_name="get_absolute_url")
    hit_count = serializers.SerializerMethodField(method_name="get_hit_count")
    files = PostFileSerializer(many=True, read_only=True)
    uploaded_files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False
    )
    author = serializers.CharField(source='author.display_name', read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "image",
            "author",
            "content",
            'links',
            "snippet",
            "absolute_url",
            "relative_url",
            "published_date",
            "created_date",
            "status",
            "category",
            "tag",
            "hit_count",
            "files",
            "uploaded_files",
        ]
        read_only_fields = ["author"]

    def get_absolute_url(self, obj):
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.get_absolute_api_url())
        return obj.get_absolute_api_url()

    def to_representation(self, instance):
        request = self.context.get("request")
        rep = super().to_representation(instance)
        rep["state"] = "list"

        if request and request.parser_context.get("kwargs", {}).get("pk"):
            rep["state"] = "single"
            rep.pop("snippet", None)
            rep.pop("relative_url", None)
            rep.pop("absolute_url", None)
        else:
            rep.pop("content", None)

        rep["category"] = RecursiveCategorySerializer(
            instance.category.all(),
            context={"request": request},
            many=True,
        ).data
        rep["tag"] = TagSerializer(
            instance.tag.all(),
            context={"request": request},
            many=True,
        ).data
        return rep

    def create(self, validated_data):
        uploaded_files = validated_data.pop("uploaded_files", [])
        categories = validated_data.pop("category", [])
        tags = validated_data.pop("tag", [])

        validated_data["author"] = Profile.objects.get(
            user=self.context["request"].user
        )

        post = Post.objects.create(**validated_data)
        post.category.set(categories)
        post.tag.set(tags)

        for file in uploaded_files:
            PostFile.objects.create(post=post, file=file)

        return post

    def update(self, instance, validated_data):
        uploaded_files = validated_data.pop("uploaded_files", None)
        categories = validated_data.pop("category", None)
        tags = validated_data.pop("tag", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if categories is not None:
            instance.category.set(categories)

        if tags is not None:
            instance.tag.set(tags)

        if uploaded_files:
            for file in uploaded_files:
                PostFile.objects.create(post=instance, file=file)

        return instance
    
    def get_hit_count(self, obj):
        hit_count_obj = obj.hit_count_generic.all().first()
        return hit_count_obj.hits if hit_count_obj else 0
        
