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






T = TypeVar("T", bound="ListManuscriptVersionsResponse200Item")



@_attrs_define
class ListManuscriptVersionsResponse200Item:
    """ 
        Attributes:
            id (UUID): Unique identifier for the version
            manuscript_id (UUID): ID of the parent manuscript
            version_number (int): Sequential version number (1, 2, 3, ...)
            label (None | str): Optional label (e.g. 'Initial draft', 'Revised after feedback')
            created_at (datetime.datetime): When the version was created
     """

    id: UUID
    manuscript_id: UUID
    version_number: int
    label: None | str
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        manuscript_id = str(self.manuscript_id)

        version_number = self.version_number

        label: None | str
        label = self.label

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "manuscriptId": manuscript_id,
            "versionNumber": version_number,
            "label": label,
            "createdAt": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        manuscript_id = UUID(d.pop("manuscriptId"))




        version_number = d.pop("versionNumber")

        def _parse_label(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        label = _parse_label(d.pop("label"))


        created_at = isoparse(d.pop("createdAt"))




        list_manuscript_versions_response_200_item = cls(
            id=id,
            manuscript_id=manuscript_id,
            version_number=version_number,
            label=label,
            created_at=created_at,
        )


        list_manuscript_versions_response_200_item.additional_properties = d
        return list_manuscript_versions_response_200_item

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
