from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.utils.urls import replace_query_param

class CommentPagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 50

    def get_paginated_response(self, data):
        return Response({
            "total_objects":       self.page.paginator.count,
            "total_pages":         self.page.paginator.num_pages,
            "current_page_number": self.page.number,
            "next":                self.get_next_link(),
            "previous":            self.get_previous_link(),
            "results":             data,
        })
