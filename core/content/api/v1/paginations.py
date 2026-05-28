from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.utils.urls import replace_query_param
class DefaultPagination(PageNumberPagination):
    page_size = 3

    def get_paginated_response(self, data):
        current_url = self.request.build_absolute_uri()
        return Response(
            {
                "links": {
                    "next": self.get_next_link(),
                    "previous": self.get_previous_link(),
                    "first": replace_query_param(current_url, self.page_query_param, 1),
                    "last": replace_query_param(
                        current_url,
                        self.page_query_param,
                        self.page.paginator.num_pages
                    ),
                },
                "total_objects": self.page.paginator.count,
                "current_page_number": self.page.number,
                "total_pages": self.page.paginator.num_pages,
                "results": data,
            }
        )
