from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_pipeline_comments_response_200_item_stage import ListPipelineCommentsResponse200ItemStage
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListPipelineCommentsResponse200Item")



@_attrs_define
class ListPipelineCommentsResponse200Item:
    """ 
        Attributes:
            id (UUID):
            pipeline_item_id (UUID):
            author_id (None | UUID):
            content (str):
            stage (ListPipelineCommentsResponse200ItemStage): Current pipeline stage for the piece
            created_at (datetime.datetime):
     """

    id: UUID
    pipeline_item_id: UUID
    author_id: None | UUID
    content: str
    stage: ListPipelineCommentsResponse200ItemStage
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        pipeline_item_id = str(self.pipeline_item_id)

        author_id: None | str
        if isinstance(self.author_id, UUID):
            author_id = str(self.author_id)
        else:
            author_id = self.author_id

        content = self.content

        stage = self.stage.value

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "pipelineItemId": pipeline_item_id,
            "authorId": author_id,
            "content": content,
            "stage": stage,
            "createdAt": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        pipeline_item_id = UUID(d.pop("pipelineItemId"))




        def _parse_author_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                author_id_type_0 = UUID(data)



                return author_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        author_id = _parse_author_id(d.pop("authorId"))


        content = d.pop("content")

        stage = ListPipelineCommentsResponse200ItemStage(d.pop("stage"))




        created_at = isoparse(d.pop("createdAt"))




        list_pipeline_comments_response_200_item = cls(
            id=id,
            pipeline_item_id=pipeline_item_id,
            author_id=author_id,
            content=content,
            stage=stage,
            created_at=created_at,
        )


        list_pipeline_comments_response_200_item.additional_properties = d
        return list_pipeline_comments_response_200_item

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
