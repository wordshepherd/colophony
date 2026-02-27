from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="CreateIssueBody")



@_attrs_define
class CreateIssueBody:
    """ 
        Attributes:
            publication_id (UUID): Publication ID
            title (str): Issue title
            volume (int | Unset): Volume number
            issue_number (int | Unset): Issue number
            description (str | Unset): Issue description
            cover_image_url (str | Unset): Cover image URL
            publication_date (datetime.datetime | Unset): Scheduled publication date
     """

    publication_id: UUID
    title: str
    volume: int | Unset = UNSET
    issue_number: int | Unset = UNSET
    description: str | Unset = UNSET
    cover_image_url: str | Unset = UNSET
    publication_date: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        publication_id = str(self.publication_id)

        title = self.title

        volume = self.volume

        issue_number = self.issue_number

        description = self.description

        cover_image_url = self.cover_image_url

        publication_date: str | Unset = UNSET
        if not isinstance(self.publication_date, Unset):
            publication_date = self.publication_date.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "publicationId": publication_id,
            "title": title,
        })
        if volume is not UNSET:
            field_dict["volume"] = volume
        if issue_number is not UNSET:
            field_dict["issueNumber"] = issue_number
        if description is not UNSET:
            field_dict["description"] = description
        if cover_image_url is not UNSET:
            field_dict["coverImageUrl"] = cover_image_url
        if publication_date is not UNSET:
            field_dict["publicationDate"] = publication_date

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        publication_id = UUID(d.pop("publicationId"))




        title = d.pop("title")

        volume = d.pop("volume", UNSET)

        issue_number = d.pop("issueNumber", UNSET)

        description = d.pop("description", UNSET)

        cover_image_url = d.pop("coverImageUrl", UNSET)

        _publication_date = d.pop("publicationDate", UNSET)
        publication_date: datetime.datetime | Unset
        if isinstance(_publication_date,  Unset):
            publication_date = UNSET
        else:
            publication_date = isoparse(_publication_date)




        create_issue_body = cls(
            publication_id=publication_id,
            title=title,
            volume=volume,
            issue_number=issue_number,
            description=description,
            cover_image_url=cover_image_url,
            publication_date=publication_date,
        )


        create_issue_body.additional_properties = d
        return create_issue_body

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
