from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListManuscriptsResponse200ItemsItem")



@_attrs_define
class ListManuscriptsResponse200ItemsItem:
    """ 
        Attributes:
            id (UUID): Unique identifier for the manuscript
            owner_id (UUID): ID of the user who owns this manuscript
            title (str): Title of the manuscript
            description (None | str): Optional description of the manuscript
            created_at (datetime.datetime): When the manuscript was created
            updated_at (datetime.datetime): When the manuscript was last updated
     """

    id: UUID
    owner_id: UUID
    title: str
    description: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        owner_id = str(self.owner_id)

        title = self.title

        description: None | str
        description = self.description

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "ownerId": owner_id,
            "title": title,
            "description": description,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        owner_id = UUID(d.pop("ownerId"))




        title = d.pop("title")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        list_manuscripts_response_200_items_item = cls(
            id=id,
            owner_id=owner_id,
            title=title,
            description=description,
            created_at=created_at,
            updated_at=updated_at,
        )


        list_manuscripts_response_200_items_item.additional_properties = d
        return list_manuscripts_response_200_items_item

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
